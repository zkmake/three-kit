# @zkmake/three-quality

## 0.1.1

### Patch Changes

- [`4359329`](https://github.com/zkmake/three-kit/commit/43593292b5757807f0ac7327e0d166f97150ee35) Thanks [@zkmake](https://github.com/zkmake)! - README: documents `refresh()`, `dispose()`, `level` and `dpr` on the handle, the `storage` option, which options are vanilla only, the hooks' `store` argument, skipped half steps on the ladder, and three-devtools' `quality` option.

## 0.1.0

### Minor Changes

- [`f5ee578`](https://github.com/zkmake/three-kit/commit/f5ee578686d5165ada0ada9139b0fd4cceb852b4) Thanks [@zkmake](https://github.com/zkmake)! - First release: render quality that adapts to the device at runtime. `adaptQuality(renderer)` steps the pixel ratio down when the window's p90 frame misses the target and back up after sustained time on target, with hysteresis; undoes a step that didn't speed frames up (`cpu-bound`); turns the app's tiers off in order once the ratio bottoms out; remembers the settled setting per device and a player's `pin`. Frame timestamps only, so WebGL and WebGPU alike, zero dependencies. React Three Fiber: `<AdaptiveQuality>`, `useAdaptiveQuality`, `useQualityTier`, `qualityStore`.
