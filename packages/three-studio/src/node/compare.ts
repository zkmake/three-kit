/** Comparing shots: a pixel diff with a mask, and a before/after montage. */
import type { Rgba } from "./png.ts";

export type DiffOptions = {
  /** How far a channel may move, as a share of its range, before the pixel counts. Default 0.03. */
  fuzz?: number | undefined;
};

export type DiffResult = {
  /** Pixels that differ beyond the fuzz. */
  pixels: number;
  total: number;
  /** `pixels / total`; about 0.0001 reads as identical. */
  share: number;
  /** White where the pixels differ, the before image dimmed elsewhere. */
  mask: Rgba;
};

/**
 * Counts the pixels whose largest channel difference (alpha included) exceeds `fuzz`. Both images
 * must be the same size.
 */
export function diffImages(before: Rgba, after: Rgba, options: DiffOptions = {}): DiffResult {
  if (before.width !== after.width || before.height !== after.height) {
    throw new Error(
      `sizes differ: ${before.width} × ${before.height} and ${after.width} × ${after.height}`,
    );
  }

  const limit = (options.fuzz ?? 0.03) * 255;
  const total = before.width * before.height;
  const mask = new Uint8Array(total * 4);
  let pixels = 0;

  for (let i = 0; i < total; i += 1) {
    const o = i * 4;
    let most = 0;

    for (let c = 0; c < 4; c += 1) {
      most = Math.max(
        most,
        Math.abs((before.data[o + c] as number) - (after.data[o + c] as number)),
      );
    }

    if (most > limit) {
      pixels += 1;
      mask.fill(255, o, o + 4);
    } else {
      const grey =
        0.299 * (before.data[o] as number) +
        0.587 * (before.data[o + 1] as number) +
        0.114 * (before.data[o + 2] as number);

      mask.fill(Math.round(grey * 0.25), o, o + 3);
      mask[o + 3] = 255;
    }
  }

  return {
    pixels,
    total,
    share: total ? pixels / total : 0,
    mask: { width: before.width, height: before.height, data: mask },
  };
}

/** Scales by area averaging (shrinking) or nearest pixel (growing). */
export function scaleImage(image: Rgba, scale: number): Rgba {
  if (scale === 1) {
    return image;
  }

  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const data = new Uint8Array(width * height * 4);
  const sx = image.width / width;
  const sy = image.height / height;

  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));

    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      const sum = [0, 0, 0, 0];

      for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) {
          const s = (yy * image.width + xx) * 4;

          for (let c = 0; c < 4; c += 1) {
            sum[c] = (sum[c] as number) + (image.data[s + c] as number);
          }
        }
      }

      const n = (y1 - y0) * (x1 - x0);

      for (let c = 0; c < 4; c += 1) {
        data[(y * width + x) * 4 + c] = Math.round((sum[c] as number) / n);
      }
    }
  }

  return { width, height, data };
}

export type MontageOptions = {
  /** Scale of the result. Default 0.5, like two screenshots side by side halved. */
  scale?: number | undefined;
  /** Pixels between images, before scaling. Default 8. */
  gap?: number | undefined;
  /** RGBA behind and between. Default white. */
  background?: readonly [number, number, number, number] | undefined;
};

/**
 * One row per pair, before left and after right, rows stacked: the comparison image a model or
 * scene pass reports with.
 */
export function montage(
  pairs: readonly (readonly [Rgba, Rgba])[],
  options: MontageOptions = {},
): Rgba {
  if (pairs.length === 0) {
    throw new Error("montage needs at least one before/after pair");
  }

  const gap = options.gap ?? 8;
  const background = options.background ?? [255, 255, 255, 255];
  const width = Math.max(...pairs.map(([a, b]) => a.width + gap + b.width));
  const height =
    pairs.reduce((sum, [a, b]) => sum + Math.max(a.height, b.height), 0) + gap * (pairs.length - 1);
  const data = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i += 1) {
    data.set(background, i * 4);
  }

  const paste = (image: Rgba, left: number, top: number) => {
    for (let y = 0; y < image.height; y += 1) {
      const from = y * image.width * 4;

      data.set(image.data.subarray(from, from + image.width * 4), ((top + y) * width + left) * 4);
    }
  };

  let top = 0;

  for (const [before, after] of pairs) {
    paste(before, 0, top);
    paste(after, before.width + gap, top);
    top += Math.max(before.height, after.height) + gap;
  }

  return scaleImage({ width, height, data }, options.scale ?? 0.5);
}
