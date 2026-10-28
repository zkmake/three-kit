import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { afterAll, describe, expect, test } from "vitest";

import { diffImages, montage, scaleImage } from "./compare.ts";
import { decodePng, encodePng, type Rgba } from "./png.ts";
import { startShotServer } from "./serve.ts";

const solid = (width: number, height: number, rgba: [number, number, number, number]): Rgba => {
  const data = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i += 1) {
    data.set(rgba, i * 4);
  }

  return { width, height, data };
};

/** A gradient, so every filter has something to predict. */
const gradient = (width: number, height: number): Rgba => {
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set([x * 20, y * 30, (x * y * 7) & 255, 200 + x], (y * width + x) * 4);
    }
  }

  return { width, height, data };
};

/** A PNG built by hand: colour type 2 (RGB), each row under the next filter type, 0 to 4. */
const rgbPng = (image: Rgba) => {
  const stride = image.width * 3;
  const encoded: number[] = [];
  let prev: number[] | null = null;

  for (let y = 0; y < image.height; y += 1) {
    const rgb = Array.from(
      { length: stride },
      (_, i) => image.data[(y * image.width + Math.floor(i / 3)) * 4 + (i % 3)] as number,
    );
    const filter = y % 5;

    encoded.push(filter);

    for (let x = 0; x < stride; x += 1) {
      const left = x >= 3 ? (rgb[x - 3] as number) : 0;
      const up = prev ? (prev[x] as number) : 0;
      const corner = prev && x >= 3 ? (prev[x - 3] as number) : 0;
      const p = left + up - corner;
      const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - corner)];
      const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? up : corner;
      const predicted = [0, left, up, (left + up) >> 1, paeth][filter] as number;

      encoded.push(((rgb[x] as number) - predicted) & 255);
    }

    prev = rgb;
  }

  const header = Buffer.alloc(13);

  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header[8] = 8;
  header[9] = 2;

  const chunk = (kind: string, body: Buffer) => {
    const head = Buffer.alloc(8);

    head.writeUInt32BE(body.length, 0);
    head.write(kind, 4, "latin1");

    // decodePng doesn't check CRCs; zeros keep the fixture short.
    return Buffer.concat([head, body, Buffer.alloc(4)]);
  };

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from(encoded))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

describe("png", () => {
  test("round-trips RGBA", () => {
    const image = gradient(9, 7);
    const back = decodePng(encodePng(image));

    expect(back.width).toBe(9);
    expect(back.height).toBe(7);
    expect(Buffer.from(back.data).equals(Buffer.from(image.data))).toBe(true);
  });

  test("decodes RGB rows under every filter", () => {
    const image = gradient(6, 10);
    const back = decodePng(rgbPng(image));

    for (let i = 0; i < 60; i += 1) {
      expect([...back.data.subarray(i * 4, i * 4 + 3)]).toEqual([
        ...image.data.subarray(i * 4, i * 4 + 3),
      ]);
      expect(back.data[i * 4 + 3]).toBe(255);
    }
  });

  test("refuses what it can't read", () => {
    expect(() => decodePng(Buffer.from("GIF89a"))).toThrow(/not a PNG/);
  });
});

describe("compare", () => {
  test("counts pixels past the fuzz and paints them white in the mask", () => {
    const before = solid(4, 4, [100, 100, 100, 255]);
    const after = solid(4, 4, [100, 100, 100, 255]);

    after.data.set([105, 100, 100, 255], 0);
    after.data.set([200, 100, 100, 255], 4);

    const result = diffImages(before, after);

    expect(result).toMatchObject({ pixels: 1, total: 16, share: 1 / 16 });
    expect([...result.mask.data.subarray(4, 8)]).toEqual([255, 255, 255, 255]);
    expect(diffImages(before, after, { fuzz: 0 }).pixels).toBe(2);
    expect(() => diffImages(before, solid(2, 2, [0, 0, 0, 0]))).toThrow(/sizes differ/);
  });

  test("scales down by averaging", () => {
    const image = solid(4, 2, [0, 0, 0, 255]);

    image.data.set([255, 255, 255, 255], 0);

    const half = scaleImage(image, 0.5);

    expect([half.width, half.height]).toEqual([2, 1]);
    expect(half.data[0]).toBe(64);
  });

  test("montage lays pairs side by side, rows stacked", () => {
    const red = solid(10, 6, [255, 0, 0, 255]);
    const blue = solid(10, 6, [0, 0, 255, 255]);
    const out = montage(
      [
        [red, blue],
        [blue, red],
      ],
      { scale: 1, gap: 2 },
    );

    expect([out.width, out.height]).toEqual([22, 14]);
    expect([...out.data.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...out.data.subarray(12 * 4, 12 * 4 + 4)]).toEqual([0, 0, 255, 255]);
    // The gap between rows is background.
    expect([...out.data.subarray(6 * 22 * 4, 6 * 22 * 4 + 4)]).toEqual([255, 255, 255, 255]);
  });
});

describe("startShotServer", () => {
  const root = mkdtempSync(join(tmpdir(), "three-studio-"));

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  test("writes PNGs inside its folder and refuses everything else", async () => {
    const lines: string[] = [];
    const shots = await startShotServer(root, { port: 0, log: (line) => lines.push(line) });
    const png = encodePng(gradient(3, 3));
    const post = (path: string, body: Buffer = png) =>
      fetch(`${shots.url}/shot?path=${encodeURIComponent(path)}`, {
        method: "POST",
        body: new Blob([new Uint8Array(body)]),
      });

    try {
      const relative = await post("round-1/close.png");

      expect(relative.status).toBe(200);
      expect(await relative.text()).toBe(join(shots.root, "round-1/close.png"));
      expect(readFileSync(join(root, "round-1/close.png")).equals(png)).toBe(true);
      expect(lines).toHaveLength(1);

      const absolute = await post(join(shots.root, "play.png"));

      expect(absolute.status).toBe(200);
      expect(relative.headers.get("access-control-allow-origin")).toBe("*");

      expect((await post("../escape.png")).status).toBe(403);
      expect((await post("/tmp/elsewhere.png")).status).toBe(403);
      expect((await post("notes.txt")).status).toBe(400);
      expect((await post("fake.png", Buffer.from("hello world"))).status).toBe(415);
      expect((await fetch(`${shots.url}/shot`, { method: "OPTIONS" })).status).toBe(204);
    } finally {
      await shots.close();
    }
  });
});
