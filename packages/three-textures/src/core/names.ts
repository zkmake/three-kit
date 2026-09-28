import type { Texture } from "three";

/** Vite's default asset name is `[name]-[hash][ext]` with an 8-character base64url hash. */
const VITE_HASH = /-[A-Za-z0-9_-]{8}(\.[^.]+)$/;

/** The file name at the end of a URL, query and hash dropped, bundler hash stripped. */
export const fileNameOf = (url: string): string | null => {
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return null;
  }

  const last = decodeURIComponent(url.split(/[?#]/)[0]!.split("/").pop() ?? "");

  return last ? last.replace(VITE_HASH, "$1") : null;
};

/** The URL an image texture was loaded from, when it has one. */
export const sourceUrlOf = (texture: Texture): string | null => {
  const data = texture.source.data as { currentSrc?: string; src?: string } | null;
  const url = data?.currentSrc || data?.src;

  return typeof url === "string" && url.length > 0 ? url : null;
};

/** A label without its extension, for a row: `bunny-baked.webp` reads as `bunny-baked`. */
export const stem = (file: string) => file.replace(/\.[^.]+$/, "");
