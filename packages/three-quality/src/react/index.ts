/**
 * `@zkmake/three-quality/react`: `<AdaptiveQuality>` inside the `<Canvas>`, and hooks that read it
 * from anywhere on the page.
 */

export { AdaptiveQuality, useAdaptiveQuality, useQualityTier } from "./adaptive-quality.tsx";
export type { AdaptiveQualityProps } from "./adaptive-quality.tsx";
export { createQualityStore, qualityStore } from "./store.ts";
export type { QualityStore } from "./store.ts";
