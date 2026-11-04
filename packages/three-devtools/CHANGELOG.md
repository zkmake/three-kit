# @zkmake/three-devtools

## 0.2.1

### Patch Changes

- [`34347e5`](https://github.com/zkmake/three-kit/commit/34347e5a47a2ad6eb3a5ae712d9e76fe1a279329) Thanks [@zkmake](https://github.com/zkmake)! - New checks. `findIntersections` finds parts poking through each other, `findFloating` and `findSunk` parts off or under the ground, `findUnnamedMeshes` the meshes other rows can't name, `findShadowIssues` and `findColorIssues` setups that draw wrong, `textureMemory` what the textures cost on the GPU, `transparentOverdraw` the draws nothing culls and, with a camera, how many screens they cover. Each is a console helper (`intersect`, `floating`, `sunk`, `unnamed`, `shadows`, `colors`, `texmem`, `overdraw`), in `auditScene`, and, but for the two measurements, a Vitest matcher; the CLI gains `--ground <y>` and `--intersections`. `checkBudget`, `toFitBudget` and the CLI now hold `frame.textureMB`, which nothing read before. `summarizeScene` gains `unnamed`, `shadowIssues` and `colorIssues`. `installAuditHelpers` takes `camera`, which `<Studio>` and `<DevTools>` now pass. The CLI reads each image's size from its header for texture memory, and meshopt files with a fallback buffer now load.
- Updated dependencies [[`34347e5`](https://github.com/zkmake/three-kit/commit/34347e5a47a2ad6eb3a5ae712d9e76fe1a279329)]:
  - @zkmake/three-audit@0.8.0

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
