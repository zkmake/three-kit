---
"@zkmake/three-devtools": minor
---

First release: an app's dev tools behind `?debug` in one drop-in. `mountDevTools({ renderer, scene, budgets, quality, panels, dev })` for vanilla three, `<DevTools />` inside a React Three Fiber `<Canvas>`. Mounts the three-meter HUD with the app's budgets file (three-audit's `defineBudgets`) and three-quality's state (read by shape), installs three-audit's console helpers (also in dev with `dev`), and the camera and texture panels the app passes as its own `import()`s. Everything loads through `import()` only when on, so a normal load pays one URL check.
