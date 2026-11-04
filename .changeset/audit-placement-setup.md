---
"@zkmake/three-audit": minor
"@zkmake/three-devtools": patch
"@zkmake/three-studio": patch
---

New checks. `findIntersections` finds parts poking through each other, `findFloating` and `findSunk` parts off or under the ground, `findUnnamedMeshes` the meshes other rows can't name, `findShadowIssues` and `findColorIssues` setups that draw wrong, `textureMemory` what the textures cost on the GPU, `transparentOverdraw` the draws nothing culls and, with a camera, how many screens they cover. Each is a console helper (`intersect`, `floating`, `sunk`, `unnamed`, `shadows`, `colors`, `texmem`, `overdraw`), in `auditScene`, and, but for the two measurements, a Vitest matcher; the CLI gains `--ground <y>` and `--intersections`. `checkBudget`, `toFitBudget` and the CLI now hold `frame.textureMB`, which nothing read before. `summarizeScene` gains `unnamed`, `shadowIssues` and `colorIssues`. `installAuditHelpers` takes `camera`, which `<Studio>` and `<DevTools>` now pass. The CLI reads each image's size from its header for texture memory, and meshopt files with a fallback buffer now load.
