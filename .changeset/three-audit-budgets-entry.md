---
"@zkmake/three-audit": minor
---

`@zkmake/three-audit/budgets`: `defineBudgets` and `parseBudgets` alone, in a chunk with no imports. An app whose own code imports its budgets file (three-meter's HUD, three-devtools' `<DevTools budgets>`) now ships that, not the whole package: importing `defineBudgets` from the main entry put every check in the app's first load, and kept a lazy `import("@zkmake/three-audit")` from splitting off.
