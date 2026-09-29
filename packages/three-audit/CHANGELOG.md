# @zkmake/three-audit

## 0.2.2

### Patch Changes

- [`f97fa95`](https://github.com/zkmake/three-kit/commit/f97fa95bf2e42d3eb44effaf61d04f6daa129422) Thanks [@zkmake](https://github.com/zkmake)! - Fixes for agent-driven use. Frame tools no longer hang in a background tab: `ledger()`,
  `recordDrawLedger` and `blackFrames()` fail after 2 s and say why, and `ledger({ render })` records
  one call of the app's own render. `beginLedger()` is a new global. z-fighting rows name the shared
  planes and facing, the overlap's area and centre, and fold identical pairs into one row with a
  `count`. Rows name meshes by their named ancestors, and the ledger names unnamed objects the same
  way. z-fighting leaves out hidden objects, `InstancedBufferGeometry`, pairs that can't fight on
  depth, and polygon-offset materials. Every helper is also on `threeAudit`, and `{ globals: false }`
  installs only that. Scene and renderer parameters are typed structurally, so an app on a newer
  `@types/three` needs no casts.

## 0.2.1

### Patch Changes

- [`0abebb2`](https://github.com/zkmake/three-kit/commit/0abebb2f8f052d109b3de1a7753644629c76aef0) Thanks [@zkmake](https://github.com/zkmake)! - `findZFighting`: a pair counts only when each triangle's corners lie within `gap` of the other's plane, measured at the triangles. Plane offsets were compared from the world origin, so far from it two faces a degree or two apart could pair while metres apart (a coupled wagon or a station 25 m out reported fights between parts that never touch).

## 0.2.0

### Minor Changes

- [`086e47b`](https://github.com/zkmake/three-kit/commit/086e47bf7d335c12ad0781aab00fe03c470b666b) Thanks [@zkmake](https://github.com/zkmake)! - `three-audit` CLI: check `.glb` / `.gltf` models for z-fighting and NaN geometry from the command line, exit 1 on failures for CI, `--json` for machines. `@zkmake/three-audit/node` exports `loadModel` for tests. Textures are stripped before loading; Draco (via `draco3dgltf`) and Meshopt (via `meshoptimizer`) models decode when those are installed.

## 0.1.0

### Minor Changes

- First release: z-fighting, NaN geometry and triangle checks for three.js scenes, a one-frame draw-call ledger, a black-frame probe, and console helpers.
