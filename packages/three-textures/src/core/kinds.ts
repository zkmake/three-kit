/**
 * What a texture is, for swapping: an image three uploads as-is (swapped in place), GPU-ready
 * data (compressed or raw, swapped by rebinding), or something the panel can only list.
 */
import type { Texture } from "three";

export type TextureKind = "image" | "compressed" | "data" | "unsupported";

type Flags = {
  isCompressedTexture?: boolean;
  isCompressedArrayTexture?: boolean;
  isCompressedCubeTexture?: boolean;
  isDataTexture?: boolean;
  isData3DTexture?: boolean;
  isDataArrayTexture?: boolean;
  isCubeTexture?: boolean;
  isVideoTexture?: boolean;
  isDepthTexture?: boolean;
  isFramebufferTexture?: boolean;
  isRenderTargetTexture?: boolean;
  isArrayTexture?: boolean;
};

/** An element three uploads with `texImage2D` as it is: what an image swap can replace. */
export const isImageLike = (data: unknown): boolean => {
  if (data === null || typeof data !== "object") {
    return false;
  }

  const hasSize = "width" in data && "height" in data;
  const isElement =
    (typeof HTMLImageElement !== "undefined" && data instanceof HTMLImageElement) ||
    (typeof HTMLCanvasElement !== "undefined" && data instanceof HTMLCanvasElement) ||
    (typeof ImageBitmap !== "undefined" && data instanceof ImageBitmap) ||
    (typeof OffscreenCanvas !== "undefined" && data instanceof OffscreenCanvas);

  // Raw data (`{ data, width, height }`) has a typed array; an element or bitmap doesn't.
  return isElement || (hasSize && !("data" in data) && !("mipmaps" in data));
};

export const kindOf = (texture: Texture): TextureKind => {
  const flags = texture as unknown as Flags;

  if (
    flags.isCompressedArrayTexture ||
    flags.isCompressedCubeTexture ||
    flags.isData3DTexture ||
    flags.isDataArrayTexture ||
    flags.isCubeTexture ||
    flags.isVideoTexture ||
    flags.isDepthTexture ||
    flags.isFramebufferTexture ||
    flags.isRenderTargetTexture ||
    flags.isArrayTexture
  ) {
    return "unsupported";
  }

  if (flags.isCompressedTexture) {
    return "compressed";
  }

  if (flags.isDataTexture) {
    return "data";
  }

  return isImageLike(texture.source.data) ? "image" : "unsupported";
};

/** Pixel size of the base level. */
export const sizeOf = (texture: Texture): { width: number; height: number } => {
  const image = texture.source.data as { width?: number; height?: number } | null;
  const base = (texture as unknown as { mipmaps?: { width: number; height: number }[] })
    .mipmaps?.[0];

  return {
    width: base?.width ?? image?.width ?? 0,
    height: base?.height ?? image?.height ?? 0,
  };
};

/** GPU compressed format families, by three's (GL-valued) format constants. */
const FAMILIES: [number, number, string][] = [
  [33776, 33779, "BC1–3"],
  [35840, 35843, "PVRTC"],
  [35916, 35919, "BC1–3"],
  [36196, 36196, "ETC1"],
  [36283, 36286, "BC4–5"],
  [36492, 36495, "BC6–7"],
  [37488, 37497, "ETC2"],
  [37808, 37853, "ASTC"],
];

/** A short format label: `ASTC`, `ETC2`, `RGBA` data, or the image's own. */
export const formatOf = (texture: Texture): string => {
  const kind = kindOf(texture);

  if (kind === "compressed") {
    const format = texture.format as number;
    const family = FAMILIES.find(([low, high]) => format >= low && format <= high);

    return family ? family[2] : "compressed";
  }

  if (kind === "data") {
    return "data";
  }

  const data = texture.source.data as { src?: string; currentSrc?: string } | null;
  const src = data?.currentSrc || data?.src || "";
  const extension = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(src)?.[1]?.toLowerCase();

  return extension ?? (data && "getContext" in data ? "canvas" : "image");
};
