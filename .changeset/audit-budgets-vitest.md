---
"@zkmake/three-audit": minor
---

Budgets and Vitest matchers. `defineBudgets({ frame, parts })` is one typed, frozen budgets file per app; `parseBudgets` and `checkBudget` read and measure against it. `@zkmake/three-audit/vitest` adds `toFitBudget`, `toHaveNoZFighting` and `toHaveCleanGeometry` to `expect` on import, with failures that list actual against budget, the costliest meshes and the z-fighting pairs (Vitest 5, optional peer). `triangles(target)` counts a geometry's or an object's triangles. The CLI takes `--budgets <file>` (JSON or a module's default export) and `--part <name>`, and fails a model over its part's or the frame's budget.
