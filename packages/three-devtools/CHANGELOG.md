# @zkmake/three-devtools

## 0.2.0

### Minor Changes

- [`75a0fc5`](https://github.com/zkmake/three-kit/commit/75a0fc50a17889deb9254a88eec0842e7aa57f07) Thanks [@zkmake](https://github.com/zkmake)! - The HUD's footer and report list the React and React Three Fiber versions beside three's, and `monitor.getEnvironment()` gains `react` and `r3f`. `PerfSampler` and `<DevTools>` supply them; a monitor you make yourself takes a `frameworks` option (`frameworkVersions` from `@zkmake/three-meter/react`), and otherwise reports what React DevTools can tell, or `null`.

### Patch Changes

- [`68aa35a`](https://github.com/zkmake/three-kit/commit/68aa35af166baa86e7b755311fcefe8c413b8b8e) Thanks [@zkmake](https://github.com/zkmake)! - Docs: how an app with its own debug switch uses `enabled`, and when to pass `maxPixels: Infinity`.
- Updated dependencies [[`75a0fc5`](https://github.com/zkmake/three-kit/commit/75a0fc50a17889deb9254a88eec0842e7aa57f07), [`b223b4f`](https://github.com/zkmake/three-kit/commit/b223b4fa10693f0a49a69c0611b561e00f520d9d)]:
  - @zkmake/three-meter@0.14.0
  - @zkmake/three-audit@0.7.0

## 0.1.1

### Patch Changes

- [`4359329`](https://github.com/zkmake/three-kit/commit/43593292b5757807f0ac7327e0d166f97150ee35) Thanks [@zkmake](https://github.com/zkmake)! - README: `frame` and `wrap` pass through until the meter loads, WebGPU needs `trackTimestamp: true` for GPU time, panels get the `theme`, and a License section.
- Updated dependencies [[`4359329`](https://github.com/zkmake/three-kit/commit/43593292b5757807f0ac7327e0d166f97150ee35), [`4359329`](https://github.com/zkmake/three-kit/commit/43593292b5757807f0ac7327e0d166f97150ee35)]:
  - @zkmake/three-audit@0.6.1
  - @zkmake/three-meter@0.13.3

## 0.1.0

### Minor Changes

- [`5dcae36`](https://github.com/zkmake/three-kit/commit/5dcae3660ffb1e948df501b323fa50e70ff8885f) Thanks [@zkmake](https://github.com/zkmake)! - First release: an app's dev tools behind `?debug` in one drop-in. `mountDevTools({ renderer, scene, budgets, quality, panels, dev })` for vanilla three, `<DevTools />` inside a React Three Fiber `<Canvas>`. Mounts the three-meter HUD with the app's budgets file (three-audit's `defineBudgets`) and three-quality's state (read by shape), installs three-audit's console helpers (also in dev with `dev`), and the camera and texture panels the app passes as its own `import()`s. Everything loads through `import()` only when on, so a normal load pays one URL check.

### Patch Changes

- Updated dependencies [[`706c4d6`](https://github.com/zkmake/three-kit/commit/706c4d6533edd90150704757e874c02b2f8a1b40), [`cdf976d`](https://github.com/zkmake/three-kit/commit/cdf976d946d655466555d1aef75e1d681f080809)]:
  - @zkmake/three-audit@0.6.0
  - @zkmake/three-meter@0.13.1
