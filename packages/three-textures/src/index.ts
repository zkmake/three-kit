/**
 * `@zkmake/three-textures`: the textures a three.js scene draws with, and live swaps on them —
 * see one, download it, paint over it, put it back, A/B it against the original. Compressed
 * (KTX2) and data textures swap too, by rebinding an image twin with the same settings.
 *
 * No UI here: the panel is `./ui`, the React Three Fiber component `./react`.
 */

export { findTextures } from "./core/discover.ts";
export type { Found, TextureRef } from "./core/discover.ts";
export { formatOf, kindOf, sizeOf } from "./core/kinds.ts";
export type { TextureKind } from "./core/kinds.ts";
export { TextureLab } from "./core/lab.ts";
export type {
  EntryState,
  LinkState,
  SwapEvent,
  TextureEntry,
  TextureInfo,
  TextureLabOptions,
} from "./core/lab.ts";
export { canReadBack, readTexture, readTextureAsync, readTextureBlob } from "./core/readback.ts";
export { indexedDbStore, memoryStore } from "./core/store.ts";
export type { StoredSwap, SwapStore } from "./core/store.ts";
