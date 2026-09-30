---
"@zkmake/three-audit": patch
"@zkmake/three-batch": patch
---

Fix: since 0.2.2, three-audit skipped hidden objects, which included the parts a three-batch bake
hides, so z-fighting found nothing under a bake. three-audit now checks a bake's parts in place of
its merge by default (`bakes: "sources"`; `"merged"` checks what's drawn) for z-fighting, NaN and
empty geometry, `bbox` and `clearance`. three-batch flags the parts it hides with
`userData.bakeSource`; bakes without the flag are recognised by their `bakedResult` merge.
