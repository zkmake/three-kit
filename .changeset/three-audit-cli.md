---
"@zkmake/three-audit": minor
---

`three-audit` CLI: check `.glb` / `.gltf` models for z-fighting and NaN geometry from the command line, exit 1 on failures for CI, `--json` for machines. `@zkmake/three-audit/node` exports `loadModel` for tests. Textures are stripped before loading; Draco (via `draco3dgltf`) and Meshopt (via `meshoptimizer`) models decode when those are installed.
