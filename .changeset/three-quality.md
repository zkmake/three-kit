---
"@zkmake/three-quality": minor
---

First release: render quality that adapts to the device at runtime. `adaptQuality(renderer)` steps the pixel ratio down when the window's p90 frame misses the target and back up after sustained time on target, with hysteresis; undoes a step that didn't speed frames up (`cpu-bound`); turns the app's tiers off in order once the ratio bottoms out; remembers the settled setting per device and a player's `pin`. Frame timestamps only, so WebGL and WebGPU alike, zero dependencies. React Three Fiber: `<AdaptiveQuality>`, `useAdaptiveQuality`, `useQualityTier`, `qualityStore`.
