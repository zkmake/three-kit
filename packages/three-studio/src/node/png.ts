/**
 * PNG in and out with Node's zlib only, enough for screenshots: 8-bit greyscale, RGB, palette and
 * their alpha forms, not interlaced. Every image comes out as RGBA.
 */
import { deflateSync, inflateSync } from "node:zlib";

export type Rgba = { width: number; height: number; data: Uint8Array };

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;

  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }

  return c >>> 0;
});

const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff;

  for (const byte of bytes) {
    c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  }

  return (c ^ 0xffffffff) >>> 0;
};

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

export function decodePng(file: Uint8Array): Rgba {
  const buffer = Buffer.from(file.buffer, file.byteOffset, file.byteLength);

  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("not a PNG file");
  }

  let width = 0;
  let height = 0;
  let depth = 0;
  let type = 0;
  let palette: Buffer | null = null;
  let transparency: Buffer | null = null;
  const data: Buffer[] = [];

  for (let at = 8; at + 8 <= buffer.length;) {
    const length = buffer.readUInt32BE(at);
    const kind = buffer.toString("latin1", at + 4, at + 8);
    const body = buffer.subarray(at + 8, at + 8 + length);

    if (kind === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8] as number;
      type = body[9] as number;

      if (body[12] !== 0) {
        throw new Error("interlaced PNGs aren't supported");
      }
    } else if (kind === "PLTE") {
      palette = body;
    } else if (kind === "tRNS") {
      transparency = body;
    } else if (kind === "IDAT") {
      data.push(body);
    } else if (kind === "IEND") {
      break;
    }

    at += 12 + length;
  }

  const channels = CHANNELS[type];

  if (depth !== 8 || channels === undefined) {
    throw new Error(`only 8-bit PNGs are supported (this one: ${depth}-bit, colour type ${type})`);
  }

  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const rows = new Uint8Array(stride * height);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] as number;
    const src = y * (stride + 1) + 1;
    const out = y * stride;

    for (let x = 0; x < stride; x += 1) {
      const value = raw[src + x] as number;
      const left = x >= channels ? (rows[out + x - channels] as number) : 0;
      const up = y > 0 ? (rows[out - stride + x] as number) : 0;
      const corner = y > 0 && x >= channels ? (rows[out - stride + x - channels] as number) : 0;
      const predicted =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? up
              : filter === 3
                ? (left + up) >> 1
                : filter === 4
                  ? paeth(left, up, corner)
                  : Number.NaN;

      if (Number.isNaN(predicted)) {
        throw new Error(`bad PNG filter ${filter} on row ${y}`);
      }

      rows[out + x] = (value + predicted) & 0xff;
    }
  }

  const rgba = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i += 1) {
    const s = i * channels;
    const o = i * 4;

    if (type === 6) {
      rgba.set(rows.subarray(s, s + 4), o);
    } else if (type === 2) {
      rgba.set(rows.subarray(s, s + 3), o);
      rgba[o + 3] = 255;
    } else if (type === 0 || type === 4) {
      const grey = rows[s] as number;

      rgba.fill(grey, o, o + 3);
      rgba[o + 3] = type === 4 ? (rows[s + 1] as number) : 255;
    } else {
      const index = rows[s] as number;

      if (!palette) {
        throw new Error("palette PNG without a palette");
      }

      rgba.set(palette.subarray(index * 3, index * 3 + 3), o);
      rgba[o + 3] =
        transparency && index < transparency.length ? (transparency[index] as number) : 255;
    }
  }

  return { width, height, data: rgba };
}

const chunk = (kind: string, body: Uint8Array) => {
  const head = Buffer.alloc(8);

  head.writeUInt32BE(body.length, 0);
  head.write(kind, 4, "latin1");

  const crc = Buffer.alloc(4);

  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);

  return Buffer.concat([head, body, crc]);
};

/** RGBA to an 8-bit RGBA PNG, each row filtered "up" (small and quick for screenshots). */
export function encodePng({ width, height, data }: Rgba): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1);

    raw[row] = 2;

    for (let x = 0; x < stride; x += 1) {
      const above = y > 0 ? (data[(y - 1) * stride + x] as number) : 0;

      raw[row + 1 + x] = ((data[y * stride + x] as number) - above) & 0xff;
    }
  }

  const header = Buffer.alloc(13);

  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}
