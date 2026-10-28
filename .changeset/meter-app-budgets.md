---
"@zkmake/three-meter": minor
---

`budgets` (on `mountPerfHud`, `setBudgets` and `PerfHud`) also takes an app's budgets file from three-audit's `defineBudgets`, applying its `frame`: `fps` as `targetFps`, `calls` and `triangles`. Read structurally (`AppBudgets`), so three-meter stays dependency-free.
