# @zkmake/three-audit

## 0.2.1

### Patch Changes

- [`0abebb2`](https://github.com/zkmake/three-kit/commit/0abebb2f8f052d109b3de1a7753644629c76aef0) Thanks [@zkmake](https://github.com/zkmake)! - `findZFighting`: a pair counts only when each triangle's corners lie within `gap` of the other's plane, measured at the triangles. Plane offsets were compared from the world origin, so far from it two faces a degree or two apart could pair while metres apart (a coupled wagon or a station 25 m out reported fights between parts that never touch).

## 0.2.0

### Minor Changes

- [`086e47b`](https://github.com/zkmake/three-kit/commit/086e47bf7d335c12ad0781aab00fe03c470b666b) Thanks [@zkmake](https://github.com/zkmake)! - `three-audit` CLI: check `.glb` / `.gltf` models for z-fighting and NaN geometry from the command line, exit 1 on failures for CI, `--json` for machines. `@zkmake/three-audit/node` exports `loadModel` for tests. Textures are stripped before loading; Draco (via `draco3dgltf`) and Meshopt (via `meshoptimizer`) models decode when those are installed.

## 0.1.0

### Minor Changes

- First release: z-fighting, NaN geometry and triangle checks for three.js scenes, a one-frame draw-call ledger, a black-frame probe, and console helpers.
