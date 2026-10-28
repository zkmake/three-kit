/**
 * `@zkmake/three-quality`: render quality that adapts to the device, at runtime. Frame times in
 * (the loop's own timestamps: no GPU queries, WebGL and WebGPU alike), the pixel ratio and the
 * app's quality tiers out, with the settled setting remembered per device.
 *
 * `adaptQuality` is the browser glue; `createQualityController` and the ladder are the pure parts
 * under it. React Three Fiber's `<AdaptiveQuality>` is `./react`.
 */

export { adaptQuality } from "./adapt-quality.ts";
export type {
  AdaptiveQuality,
  AdaptQualityOptions,
  QualityRenderer,
  QualityState,
  QualityTier,
} from "./adapt-quality.ts";
export { createQualityController } from "./controller.ts";
export type {
  ControllerOptions,
  ControllerState,
  QualityController,
  QualityPhase,
} from "./controller.ts";
export { buildLadder, levelOf, pixelRatioCeiling } from "./ladder.ts";
export type { CeilingOptions, LadderOptions, Rung } from "./ladder.ts";
export type { QualityStorage, StoredQuality } from "./memory.ts";
