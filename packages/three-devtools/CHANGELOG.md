# @zkmake/three-devtools

## 0.1.0

### Minor Changes

- [`5dcae36`](https://github.com/zkmake/three-kit/commit/5dcae3660ffb1e948df501b323fa50e70ff8885f) Thanks [@zkmake](https://github.com/zkmake)! - First release: an app's dev tools behind `?debug` in one drop-in. `mountDevTools({ renderer, scene, budgets, quality, panels, dev })` for vanilla three, `<DevTools />` inside a React Three Fiber `<Canvas>`. Mounts the three-meter HUD with the app's budgets file (three-audit's `defineBudgets`) and three-quality's state (read by shape), installs three-audit's console helpers (also in dev with `dev`), and the camera and texture panels the app passes as its own `import()`s. Everything loads through `import()` only when on, so a normal load pays one URL check.

### Patch Changes

- Updated dependencies [[`706c4d6`](https://github.com/zkmake/three-kit/commit/706c4d6533edd90150704757e874c02b2f8a1b40), [`cdf976d`](https://github.com/zkmake/three-kit/commit/cdf976d946d655466555d1aef75e1d681f080809)]:
  - @zkmake/three-audit@0.6.0
  - @zkmake/three-meter@0.13.1
