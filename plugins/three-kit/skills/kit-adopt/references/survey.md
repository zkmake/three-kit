# Survey: what the app carries by hand

How to find each copy, count it, and name its swap. Loaded by step 0.

## Where copies hide

Search the app's source, tests, HTML entries and scripts (ripgrep, from the app's folder). Each row is a kind of copy, what gives it away, and the package that replaces it.

| Copy                     | Gives it away                                                                                                                                                                                                      | Swap                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `?debug` switch          | `URLSearchParams(…).has("debug")`, a `debug/` folder, `DEBUG` constants, `lazy(() => import("./perf-meter…"))`                                                                                                     | `@zkmake/three-devtools`                    |
| Perf HUD wiring          | `PerfHud`, `PerfSampler`, `mountPerfHud`, `PerformanceMonitor` imported by app code; a `BUDGETS = { targetFps, calls, triangles }` literal                                                                         | `@zkmake/three-devtools` + budgets file     |
| Console helpers          | `installAuditHelpers` in an effect, `window.tris = …`, helpers behind `import.meta.env.DEV`                                                                                                                        | `@zkmake/three-devtools` (`dev`)            |
| Panels                   | `<CameraPanel />`, `<TexturePanel />`, `mountCameraPanel`, `mountTexturePanel` in app code                                                                                                                         | `@zkmake/three-devtools` (`panels`)         |
| Studio or mockups shell  | `studio.html` / `mockups.html` with a page that parses `area`, `v`, `view`, `t`, `clean` itself; its own `OrbitControls` rig, chip switchers, a readout element (`#mockup-stats`, `renderer.info` read each frame) | `@zkmake/three-studio`                      |
| Shot and compare scripts | `shot-server.py`, `compare.sh`, a hand-rolled `saveShot`, `preserveDrawingBuffer: true` for captures, `studio-helpers.ts`                                                                                          | `@zkmake/three-studio` (`saveShot`, CLI)    |
| Budgets in code          | ceilings in test files (`expect(tris).toBeLessThan(…)`), a hand-written triangle counter (`index.count / 3` walks), budgets restated in comments                                                                   | budgets file + `@zkmake/three-audit/vitest` |
| Hard-coded pixel ratio   | `dpr={[1, 2]}` or `dpr={Math.min(…)}` on a game `<Canvas>`, `setPixelRatio(Math.min(window.devicePixelRatio, 2))`                                                                                                  | `@zkmake/three-quality`                     |
| Eager vendor chunk       | a chunk group (`codeSplitting.groups`, `manualChunks`) whose test catches all of `node_modules`, so lazily imported dev tools land in a chunk `index.html` preloads                                                | leave `@zkmake` out of the group            |
| Older kit pieces         | a three-audit or three-meter version behind the latest; a skill-era helper copy (`studio-helpers.ts`) beside the installed package                                                                                 | upgrade, then the swaps above               |

Copies drift: each app's version of a shared file has its own fixes. Read each one whole before swapping it, and carry its choices over (HUD placement and storage key, extra views, URL keys, a readout's wording) rather than the defaults.

## Counting

- Lines per file with `wc -l`, for every file a swap deletes or shrinks, and the lines a swap edits inside a file that stays (`git diff --stat` after the swap gives the other side).
- A file shared by several copies (a `debug/` folder holding both the switch and the HUD) is one row.
- Tests: the lines of each hand-written count or ceiling the matchers replace.

## The plan

One message to the user before changing anything: the ledger of lines (copy, files, lines, swap), what each swap keeps from the copy, the packages to install or upgrade (with versions, the project's way), and anything kept as a copy and why. Something in the tree that isn't the app's own (another person's uncommitted work in the same files) is named there too, with how the pass will stay clear of it.
