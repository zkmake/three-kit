# @zkmake/three-audit

## 0.2.0

### Minor Changes

- [`086e47b`](https://github.com/zkmake/three-kit/commit/086e47bf7d335c12ad0781aab00fe03c470b666b) Thanks [@zkmake](https://github.com/zkmake)! - `three-audit` CLI: check `.glb` / `.gltf` models for z-fighting and NaN geometry from the command line, exit 1 on failures for CI, `--json` for machines. `@zkmake/three-audit/node` exports `loadModel` for tests. Textures are stripped before loading; Draco (via `draco3dgltf`) and Meshopt (via `meshoptimizer`) models decode when those are installed.

## 0.1.0

### Minor Changes

- First release: z-fighting, NaN geometry and triangle checks for three.js scenes, a one-frame draw-call ledger, a black-frame probe, and console helpers.
