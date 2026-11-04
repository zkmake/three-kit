---
"@zkmake/three-audit": minor
---

`ledger()`, `beginLedger()` and `recordDrawLedger()` work on `WebGPURenderer`, on either backend. A pass with an unnamed scene goes by its target texture's name before `render 1`. Fixes for geometry a shader positions: a 2D `position` no longer reports a false NaN or skews measurements, and z-fighting leaves out such geometry and node materials with a `positionNode` or `vertexNode`, whose stored positions aren't where they draw.
