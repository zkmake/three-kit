import { describe, expect, test } from "vitest";

import { imageSize } from "./image-size.ts";

const bytes = (length: number, set: (view: DataView, raw: Uint8Array) => void) => {
  const raw = new Uint8Array(length);

  set(new DataView(raw.buffer), raw);

  return raw;
};

const ascii = (raw: Uint8Array, text: string, at: number) => {
  raw.set(new TextEncoder().encode(text), at);
};

describe("imageSize", () => {
  test("PNG", () => {
    const png = bytes(24, (view, raw) => {
      raw.set([0x89, 0x50, 0x4e, 0x47]);
      view.setUint32(16, 1024);
      view.setUint32(20, 512);
    });

    expect(imageSize(png)).toEqual({ width: 1024, height: 512, format: "RGBA8", bytesPerPixel: 4 });
  });

  test("JPEG: the frame header, past other segments", () => {
    const jpeg = bytes(40, (view, raw) => {
      raw.set([0xff, 0xd8, 0xff, 0xe0]);
      view.setUint16(4, 10);
      raw.set([0xff, 0xc2], 14);
      view.setUint16(16, 17);
      view.setUint16(19, 300);
      view.setUint16(21, 400);
    });

    expect(imageSize(jpeg)).toMatchObject({ width: 400, height: 300, format: "RGBA8" });
  });

  test("a JPEG's Huffman table isn't its frame", () => {
    const jpeg = bytes(40, (view, raw) => {
      raw.set([0xff, 0xd8, 0xff, 0xc4]);
      view.setUint16(4, 10);
      raw.set([0xff, 0xc0], 14);
      view.setUint16(16, 17);
      view.setUint16(19, 64);
      view.setUint16(21, 128);
    });

    expect(imageSize(jpeg)).toMatchObject({ width: 128, height: 64 });
  });

  test("WebP's three kinds", () => {
    const riff = (chunk: string, set: (view: DataView, raw: Uint8Array) => void) =>
      bytes(40, (view, raw) => {
        ascii(raw, "RIFF", 0);
        ascii(raw, "WEBP", 8);
        ascii(raw, chunk, 12);
        set(view, raw);
      });

    expect(
      imageSize(
        riff("VP8X", (_, raw) => {
          raw.set([255, 0, 0], 24);
          raw.set([127, 0, 0], 27);
        }),
      ),
    ).toMatchObject({ width: 256, height: 128 });
    expect(
      imageSize(
        riff("VP8 ", (view) => {
          view.setUint16(26, 640, true);
          view.setUint16(28, 480, true);
        }),
      ),
    ).toMatchObject({ width: 640, height: 480 });
    expect(
      imageSize(
        riff("VP8L", (view) => {
          view.setUint32(21, 99 | (49 << 14), true);
        }),
      ),
    ).toMatchObject({ width: 100, height: 50 });
  });

  test("KTX2: GPU-compressed", () => {
    const ktx = bytes(28, (view, raw) => {
      raw.set([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30]);
      view.setUint32(20, 2048, true);
      view.setUint32(24, 1024, true);
    });

    expect(imageSize(ktx)).toEqual({
      width: 2048,
      height: 1024,
      format: "compressed",
      bytesPerPixel: 1,
    });
  });

  test("what it doesn't know, or a file cut short, is null", () => {
    expect(imageSize(new Uint8Array(40))).toBeNull();
    expect(imageSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(imageSize(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
  });
});
