/**
 * `@zkmake/three-studio/node`: the shot receiver and PNG tools behind the `three-studio` bin, for
 * scripts and CI: decode and encode PNGs, diff two shots, lay out before/after montages.
 */
export {
  diffImages,
  type DiffOptions,
  type DiffResult,
  montage,
  type MontageOptions,
  scaleImage,
} from "./compare.ts";
export { decodePng, encodePng, type Rgba } from "./png.ts";
export { type ShotServer, type ShotServerOptions, startShotServer } from "./serve.ts";
