import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";

import { decodePng, encodePng, type Rgba } from "../node/png.ts";
import { main } from "./main.ts";

const dir = mkdtempSync(join(tmpdir(), "three-studio-cli-"));
const file = (name: string) => join(dir, name);

const solid = (rgba: [number, number, number, number], width = 10, height = 10): Rgba => {
  const data = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i += 1) {
    data.set(rgba, i * 4);
  }

  return { width, height, data };
};

const changed = solid([20, 40, 60, 255]);

changed.data.set([250, 40, 60, 255], 0);
writeFileSync(file("a.png"), encodePng(solid([20, 40, 60, 255])));
writeFileSync(file("b.png"), encodePng(changed));

const output = () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  return {
    log: () => log.mock.calls.map((call) => call.join(" ")).join("\n"),
    error: () => error.mock.calls.map((call) => call.join(" ")).join("\n"),
  };
};

afterEach(() => vi.restoreAllMocks());
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("diff", () => {
  test("prints the share that differs and exits 0", async () => {
    const out = output();

    expect(await main(["diff", file("a.png"), file("b.png")])).toBe(0);
    expect(out.log()).toBe("1 px differ (1.0000%)");
  });

  test("exits 1 past --max, writes the mask, prints JSON", async () => {
    const out = output();

    expect(
      await main([
        "diff",
        file("a.png"),
        file("b.png"),
        "--max",
        "0.5",
        "--out",
        file("mask.png"),
        "--json",
      ]),
    ).toBe(1);
    expect(JSON.parse(out.log())).toEqual({ pixels: 1, total: 100, share: 0.01, over: true });
    expect([...decodePng(readFileSync(file("mask.png"))).data.subarray(0, 4)]).toEqual([
      255, 255, 255, 255,
    ]);
  });

  test("exits 2 on a file it can't read or a bad option", async () => {
    const out = output();

    expect(await main(["diff", file("a.png"), file("missing.png")])).toBe(2);
    expect(await main(["diff", file("a.png"), file("b.png"), "--fuzz", "300"])).toBe(2);
    expect(out.error()).toMatch(/ENOENT[\s\S]*--fuzz must be a percentage/);
  });
});

test("montage writes one image of the pairs", async () => {
  output();

  expect(
    await main([
      "montage",
      file("m.png"),
      file("a.png"),
      file("b.png"),
      "--scale",
      "1",
      "--gap",
      "0",
    ]),
  ).toBe(0);

  const image = decodePng(readFileSync(file("m.png")));

  expect([image.width, image.height]).toEqual([20, 10]);
  expect(image.data[10 * 4]).toBe(250);
});

test("serve receives shots until stopped", async () => {
  const out = output();
  let stop = () => {};
  const stopped = new Promise<void>((resolve) => (stop = resolve));
  const running = main(["serve", file("shots"), "--port", "0"], { stop: stopped });

  await vi.waitFor(() => expect(out.log()).toMatch(/from http:\/\/127\.0\.0\.1:\d+/));

  const url = /from (http:\S+)/.exec(out.log())?.[1] as string;
  const response = await fetch(`${url}/shot?path=one.png`, {
    method: "POST",
    body: new Blob([new Uint8Array(readFileSync(file("a.png")))]),
  });

  expect(response.status).toBe(200);
  expect(existsSync(file("shots/one.png"))).toBe(true);
  stop();
  expect(await running).toBe(0);
});

test("serve on a taken port says how to pick another", async () => {
  const out = output();
  let stop = () => {};
  const stopped = new Promise<void>((resolve) => (stop = resolve));
  const first = main(["serve", file("shots"), "--port", "0"], { stop: stopped });

  await vi.waitFor(() => expect(out.log()).toMatch(/from http:\/\/127\.0\.0\.1:\d+/));

  const port = /127\.0\.0\.1:(\d+)/.exec(out.log())?.[1] as string;

  expect(await main(["serve", file("shots"), "--port", port])).toBe(2);
  expect(out.error()).toMatch(new RegExp(`port ${port} is taken.*&shots=`));
  stop();
  await first;
});

test("help, version and nonsense", async () => {
  const out = output();

  expect(await main(["--help"])).toBe(0);
  expect(await main(["-v"])).toBe(0);
  expect(await main(["paint"])).toBe(2);
  expect(out.log()).toMatch(/Usage: three-studio[\s\S]*\n\d+\.\d+\.\d+$/);
});
