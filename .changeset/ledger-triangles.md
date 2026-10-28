---
"@zkmake/three-audit": minor
---

The draw ledger counts triangles per object and group (`triangles`, `passTriangles` on each row, a column in `printDrawLedger`), and a `BatchedMesh`'s are the instances three actually drew after per-instance culling, not every visible one.
