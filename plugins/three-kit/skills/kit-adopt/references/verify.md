# Verify: before, after, and nothing changed

Loaded by steps 1 and 7. The browser is one your agent can script, one session at a time; a hidden pane or background tab gets no animation frames, so go headless when the pane is hidden (the perf-pass skill's [../../perf-pass/references/survey.md](../../perf-pass/references/survey.md), _Driving the app_). Mute the app's audio once it loads. One fixed viewport for every shot (1200 × 800).

## Before

- **Shots**: the game at each play position (reached the same scripted way every time, animation frozen or at a fixed moment if the app allows), and every studio area's `play` view (`&t=0&clean=1`). Save with the old page's own capture, or a browser screenshot of the canvas when it has none; the after shots are taken the same way.
- **Numbers**: `ledger()` at each play position (draws and triangles, every pass), from the console helpers the app has today.
- **Bundle**: the production build's entry chunk size and the chunk list, so the after can show the tools didn't move into the first load.
- **Checks**: typecheck, lint, tests, build, run the project's way. Note any that already fail.

## After

- **Checks**: the same, all green (or failing exactly as before, said so).
- **Without the flag**, on the production build (`vite preview` or the project's equivalent): load the game, read the network requests: no chunk holding three-meter, three-audit or a panel is fetched. In the built files, the entry chunk holds none of the tools' code: search it for three-meter's `PerformanceMonitor` and three-audit's `findZFighting` (a bare `installAuditHelpers` there is only the name the drop-in calls).
- **With `?debug`**: the HUD shows, docked where the copy had it, with the budgets file's lines (calls and triangles amber past `frame`) and the quality line (`dpr 1.5 · steady`); `tris()` and `ledger()` answer in the console; each panel the app asked for opens. In dev without the flag, the console helpers answer and no HUD shows.
- **Studio**: every area and view the old page had opens, the readout fills, `summary()` answers, `saveShot` writes through `three-studio serve`.
- **Play-view diff**: the after shots at the same positions and views, then `three-studio diff before.png after.png --max 0.1 --out mask.png` for each pair and a `three-studio montage` of all pairs. The game's shots at a pinned quality rung equal to the old ratio, so the swap to adaptive quality doesn't show as a difference.
- **Numbers**: `ledger()` at each play position again; draws and triangles match the baseline (a pass that moves no geometry moves no numbers).

Done when the checks are green, the bundle and network checks hold, and every diff is about 0.1% of pixels or under with nothing in its mask.
