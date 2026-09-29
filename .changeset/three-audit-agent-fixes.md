---
"@zkmake/three-audit": patch
---

Fixes for agent-driven use. Frame tools no longer hang in a background tab: `ledger()`,
`recordDrawLedger` and `blackFrames()` fail after 2 s and say why, and `ledger({ render })` records
one call of the app's own render. `beginLedger()` is a new global. z-fighting rows name the shared
planes and facing, the overlap's area and centre, and fold identical pairs into one row with a
`count`. Rows name meshes by their named ancestors, and the ledger names unnamed objects the same
way. z-fighting leaves out hidden objects, `InstancedBufferGeometry`, pairs that can't fight on
depth, and polygon-offset materials. Every helper is also on `threeAudit`, and `{ globals: false }`
installs only that. Scene and renderer parameters are typed structurally, so an app on a newer
`@types/three` needs no casts.
