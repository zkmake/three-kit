import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { glb } from "../../tests/gltf.ts";
import { main } from "./main.ts";

let clean = "";
let fighting = "";
let directory = "";

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "three-audit-cli-"));

  clean = join(directory, "clean.glb");
  fighting = join(directory, "fighting.glb");
  await writeFile(
    clean,
    glb([
      { name: "floor", y: 0 },
      { name: "roof", y: 3 },
    ]),
  );
  await writeFile(
    fighting,
    glb([
      { name: "floor", y: 0 },
      { name: "decal-rug", y: 0.002, size: 0.5 },
    ]),
  );
});

const run = async (...args: string[]) => {
  const out: string[] = [];
  const err: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation((line: string) => void out.push(line));
  const error = vi
    .spyOn(console, "error")
    .mockImplementation((line: string) => void err.push(line));
  const code = await main(args);

  log.mockRestore();
  error.mockRestore();

  return { code, out: out.join("\n"), err: err.join("\n") };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("three-audit", () => {
  test("a clean model passes", async () => {
    const { code, out } = await run(clean);

    expect(code).toBe(0);
    expect(out).toContain("clean.glb  4 triangles");
    expect(out).toContain("✓ no z-fighting");
    expect(out).toContain("✓ no NaN geometry");
  });

  test("z-fighting fails the run and names the pair", async () => {
    const { code, out } = await run(clean, fighting);

    expect(code).toBe(1);
    expect(out).toContain("✗ 1 z-fighting pair");
    expect(out).toMatch(/floor .*\n.*↔ decal-rug/);
  });

  test("--gap, --skip and --no-fail", async () => {
    expect((await run(fighting, "--gap", "0.001")).code).toBe(0);
    expect((await run(fighting, "--skip", "^decal")).code).toBe(0);
    expect((await run(fighting, "--no-fail")).code).toBe(0);
  });

  test("--json", async () => {
    const { out } = await run(fighting, "--json", "--top", "1");
    const [result] = JSON.parse(out) as {
      file: string;
      report: { zFighting: unknown[]; meshes: unknown[] };
    }[];

    expect(result!.file).toBe(fighting);
    expect(result!.report.zFighting).toHaveLength(1);
    expect(result!.report.meshes).toHaveLength(1);
  });

  test("an unreadable file exits 2", async () => {
    const { code, out } = await run(join(tmpdir(), "missing.glb"));

    expect(code).toBe(2);
    expect(out).toContain("couldn't read");
  });

  test("usage errors exit 2; help and version exit 0", async () => {
    expect((await run()).code).toBe(2);
    expect((await run(clean, "--gap", "-1")).code).toBe(2);
    expect((await run("--bogus")).code).toBe(2);
    expect((await run("--help")).out).toContain("Usage: three-audit");
    expect((await run("-v")).out).toMatch(/^\d+\.\d+\.\d+$/);
  });

  describe("the placement checks", () => {
    let raised = "";
    let crossing = "";

    beforeAll(async () => {
      raised = join(directory, "raised.glb");
      crossing = join(directory, "crossing.glb");
      await writeFile(raised, glb([{ name: "tank", y: 5 }]));
      // Two quads in one plane fight; these are told apart by height, so only --ground sees them.
      await writeFile(
        crossing,
        glb([
          { name: "under", y: -1 },
          { name: "over", y: 0 },
        ]),
      );
    });

    test("are off without their flags", async () => {
      const { code, out } = await run(raised);

      expect(code).toBe(0);
      expect(out).not.toContain("floating");
    });

    test("--ground fails what floats and what's sunk", async () => {
      const floating = await run(raised, "--ground", "0");

      expect(floating.code).toBe(1);
      expect(floating.out).toContain("✗ 1 group of parts floating");
      expect(floating.out).toMatch(/tank.*: 5 up at \(0, 5, 0\)/);

      const sunk = await run(crossing, "--ground", "0");

      expect(sunk.code).toBe(1);
      expect(sunk.out).toContain("✓ nothing floating");
      expect(sunk.out).toContain("✗ 1 part sunk into the ground");
      expect(sunk.out).toMatch(/under.*: buried/);

      expect((await run(raised, "--ground", "5")).code).toBe(0);
      expect((await run(raised, "--ground", "5")).out).toContain("✓ nothing floating");
      expect((await run(raised, "--ground", "high")).code).toBe(2);
    });

    test("--intersections", async () => {
      const { code, out } = await run(raised, "--intersections");

      expect(code).toBe(0);
      expect(out).toContain("✓ no parts crossing");
    });

    test("--json carries them", async () => {
      const { out } = await run(raised, "--ground", "0", "--json");
      const [{ report }] = JSON.parse(out) as [
        { report: { floating: unknown[]; sunk: unknown[] } },
      ];

      expect(report.floating).toHaveLength(1);
      expect(report.sunk).toEqual([]);
    });
  });

  describe("texture memory", () => {
    test("reads each image's size from its header, and answers to frame.textureMB", async () => {
      const textured = join(directory, "textured.glb");
      const budgets = join(directory, "textures.json");

      await writeFile(
        textured,
        glb([{ name: "sign", y: 0 }], {
          textured: true,
          image: "data:image/png;base64,iVBORwAAAAAAAAAAAAAAAAAABAAAAAQA",
        }),
      );
      await writeFile(budgets, JSON.stringify({ frame: { textureMB: 4 } }));

      const plain = await run(textured);

      expect(plain.code).toBe(0);
      expect(plain.out).toContain("textures 5.33 MB on the GPU");
      expect(plain.out).toMatch(/5\.3 MB {2}image 0 1024×1024 RGBA8/);

      const over = await run(textured, "--budgets", budgets);

      expect(over.code).toBe(1);
      expect(over.out).toMatch(/textureMB 5\.33 > 4 {2}✗/);
    });

    test("an image it can't read is left out, not a failure", async () => {
      const junk = join(directory, "junk.glb");

      await writeFile(junk, glb([{ name: "sign", y: 0 }], { textured: true }));

      const { code, out } = await run(junk);

      expect(code).toBe(0);
      expect(out).not.toContain("textures");
    });
  });

  test("lists unnamed meshes without failing", async () => {
    const unnamed = join(directory, "unnamed.glb");

    await writeFile(unnamed, glb([{ name: "", y: 0 }]));

    const { code, out } = await run(unnamed);

    expect(code).toBe(0);
    expect(out).toContain("! 1 unnamed mesh");
  });

  describe("--budgets", () => {
    const write = async (name: string, body: string) => {
      const file = join(directory, name);

      await writeFile(file, body);

      return file;
    };

    test("holds a model to the part named like its file, and the frame", async () => {
      const budgets = await write(
        "budgets.json",
        JSON.stringify({ frame: { triangles: 100, calls: 1 }, parts: { clean: { triangles: 3 } } }),
      );
      const { code, out } = await run(clean, "--budgets", budgets);

      expect(code).toBe(1);
      expect(out).toContain('✗ over budget "clean"');
      expect(out).toMatch(/triangles 4 > 3 {2}✗/);
      // The part sets no draws, so the frame's calls hold.
      expect(out).toMatch(/draws\s+2 > 1 {2}✗/);
    });

    test("--part, a module's default export, and a pass", async () => {
      const budgets = await write(
        "budgets.mjs",
        "export default { frame: { fps: 60 }, parts: { kart: { triangles: 10, draws: 2 } } };",
      );
      const { code, out } = await run(clean, "--budgets", budgets, "--part", "kart");

      expect(code).toBe(0);
      expect(out).toContain('✓ within budget "kart"');
      expect(out).toMatch(/triangles 4 ≤ 10/);
    });

    test("a model with no part and no frame limits is noted, not failed", async () => {
      const budgets = await write("loose.json", JSON.stringify({ frame: { fps: 60 } }));
      const { code, out } = await run(clean, "--budgets", budgets);

      expect(code).toBe(0);
      expect(out).toContain("! no budget for clean.glb");
    });

    test("--json carries the checks", async () => {
      const budgets = await write(
        "frame.json",
        JSON.stringify({ frame: { triangles: 2 }, parts: {} }),
      );
      const { code, out } = await run(clean, "--budgets", budgets, "--json");
      const [result] = JSON.parse(out) as { budget: unknown }[];

      expect(code).toBe(1);
      expect(result!.budget).toEqual({
        part: null,
        checks: [{ metric: "triangles", actual: 4, limit: 2, over: true }],
      });
    });

    test("bad budgets, an unknown part or --part alone exit 2", async () => {
      const bad = await write("bad.json", JSON.stringify({ frame: { tris: 1 } }));
      const good = await write("good.json", JSON.stringify({ frame: {}, parts: { kart: {} } }));

      expect((await run(clean, "--budgets", bad)).err).toMatch(/frame has "tris"/);
      expect((await run(clean, "--budgets", bad)).code).toBe(2);
      expect((await run(clean, "--budgets", join(directory, "nope.json"))).code).toBe(2);
      expect((await run(clean, "--budgets", good, "--part", "truck")).err).toContain(
        'no part "truck"',
      );
      expect((await run(clean, "--part", "kart")).code).toBe(2);
    });
  });
});
