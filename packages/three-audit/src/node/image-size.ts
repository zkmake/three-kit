/**
 * An image's size from its header, without decoding it: PNG, JPEG, WebP and KTX2, the formats a
 * glTF file carries. GPU cost follows from what the renderer uploads: 4 bytes a pixel for what it
 * decodes, about 1 for a GPU-compressed KTX2 (BC7, ASTC 4×4).
 */
export type ImageSize = {
  width: number;
  height: number;
  format: string;
  bytesPerPixel: number;
};

const startsWith = (bytes: Uint8Array, signature: readonly number[], at = 0) =>
  signature.every((value, i) => bytes[at + i] === value);

const decoded = (width: number, height: number): ImageSize => ({
  width,
  height,
  format: "RGBA8",
  bytesPerPixel: 4,
});

const jpegSize = (bytes: Uint8Array, view: DataView) => {
  for (let at = 2; at + 9 < bytes.length;) {
    if (bytes[at] !== 0xff) {
      at += 1;
      continue;
    }

    const marker = bytes[at + 1]!;

    // Start of frame, every kind but the three other markers in its range.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return decoded(view.getUint16(at + 7), view.getUint16(at + 5));
    }

    at += marker === 0xff ? 1 : 2 + view.getUint16(at + 2);
  }

  return null;
};

const webpSize = (bytes: Uint8Array, view: DataView) => {
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));

  if (chunk === "VP8X") {
    const low = (at: number) => bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16);

    return decoded(low(24) + 1, low(27) + 1);
  }

  if (chunk === "VP8 ") {
    return decoded(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
  }

  if (chunk === "VP8L") {
    const bits = view.getUint32(21, true);

    return decoded((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
  }

  return null;
};

/** `null` for a format it doesn't know, or a file cut short. */
export const imageSize = (bytes: Uint8Array): ImageSize | null => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  try {
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) {
      return decoded(view.getUint32(16), view.getUint32(20));
    }

    if (startsWith(bytes, [0xff, 0xd8])) {
      return jpegSize(bytes, view);
    }

    if (
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
    ) {
      return webpSize(bytes, view);
    }

    if (startsWith(bytes, [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30])) {
      return {
        width: view.getUint32(20, true),
        height: view.getUint32(24, true),
        format: "compressed",
        bytesPerPixel: 1,
      };
    }
  } catch {
    return null;
  }

  return null;
};
