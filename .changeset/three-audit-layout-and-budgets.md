---
"@zkmake/three-audit": minor
---

- `geometryCensus` breaks a `BatchedMesh` down by geometry (instances × triangles each), names them
  with `label(batch, geometryId)`, and gives every row its `share` of the total, flagged
  `overBudget` past `budget`.
- `summarizeScene` / `summary(tag)` return one count per check for a tagged object, with
  `zFighting: false` to skip the slow one. `auditScene` / `report(tag)` narrow to a tag, and add
  `draws` and `emptyMeshes`. There is a new `findEmptyMeshes`.
- `measureBounds` / `bbox(target)` give an object's world envelope. `measureClearance` /
  `clearance(a, b)` give the gap between two objects, measured between triangles.
- The draw ledger adds `passStats`: draws, casters, triangles and target size per pass, with
  fullscreen post passes counted in `fullscreenPasses` and `fullscreenPixels`.
- `countDraws` counts the draw calls one main pass makes.
