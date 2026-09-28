import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { glb } from "../../tests/gltf.ts";
import { main } from "./main.ts";

let clean = "";
let fighting = "";

beforeAll(async () => {
  const directory = await mkdtemp(join(tmpdir(), "three-audit-cli-"));

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
});
