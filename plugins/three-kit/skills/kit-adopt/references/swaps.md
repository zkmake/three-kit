# Swaps

Each swap: what goes in, what comes out, what to keep from the copy. Loaded by steps 2–5. The packages' READMEs win on signatures.

## Budgets

1. **Measure today.** For each kind of part the tests build (a cube, a piece, a building), its triangles as the app builds it: three-audit's `countTriangles(object)` in a throwaway test, or `census()` in the running app. The frame's draws and triangles at each play position come from the baseline (`ledger()`).
2. **Write `src/budgets.ts`** with `defineBudgets` from `@zkmake/three-audit/budgets`, the entry that holds it alone. The app's own code imports this file (the HUD reads it), and importing from the main entry would put every check in the first load and stop the dev tools' lazy import of three-audit from splitting off:
   - `frame`: `fps`, `calls`, `triangles` from the style guide's _Budgets_. The numbers in the copies' `BUDGETS` literals came from there; where the two disagree, ask the user which holds.
   - `parts`: one entry per kind, at today's count plus the headroom the style guide allows (round up to a readable number). Never below today: this pass changes no geometry.
3. **Tests.** Import `@zkmake/three-audit/vitest` once (a setup file or the test), then hold each part: `expect(part).toFitBudget(budgets.parts.<kind>)`. Replace the hand-written counter and its ceiling with it, and add `toHaveCleanGeometry()` and `toHaveNoZFighting()` where the test builds geometry. Delete the counter once nothing uses it.
4. **Style guide.** Its _Budgets_ section says the numbers live in `src/budgets.ts` and keeps only the reasons; a number restated in prose is a copy too.

The same file feeds the HUD (step 3) and three-audit's CLI (`three-audit --budgets src/budgets.ts`), so the frame target lives in one place.

## Dev tools

Install `@zkmake/three-devtools` as a regular dependency (the app's code imports it; `?debug` works on the deployed build). It brings three-meter and three-audit; an app that imports neither elsewhere drops its direct dependencies on them in step 6.

React Three Fiber, inside the game's `<Canvas>`, once:

```tsx
<DevTools
  budgets={budgets}
  quality={qualityStore}
  dev={import.meta.env.DEV}
  hud={{ defaultPlacement: { edge: "top", align: "end" }, storageKey: "<app>:perf-hud" }}
/>
```

Vanilla: `const tools = mountDevTools({ renderer, scene, budgets, quality, dev })` after the renderer and scene exist, and `renderer.setAnimationLoop(tools.wrap(loop))` (or `tools.frame()` once a frame, before rendering).

- **Keep from the copy**: the HUD's `defaultPlacement` and `storageKey` (players' and testers' docked positions survive), the flag name if it wasn't `debug` (`flag`), whether the helpers ran in dev (`dev`).
- **Panels**: only those the copy mounted, as the app's own imports: `panels={{ cameras: () => import("@zkmake/three-cameras/ui") }}`. An app that never showed a panel installs none.
- **Out**: the switch, the lazy wrappers, the sampler/HUD pair, the helpers effect, and the two mount points (one inside the Canvas, one outside) collapse into the one element.
- **Pages that mount the copy too** (a studio or mockups page that imported the debug tools): the studio brings its own helpers and readout; drop the import there rather than adding `<DevTools>`, unless the page wants the HUD, in which case `<DevTools>` goes inside the studio's canvas through its `stage`.
- **Order**: an app whose copy mounts the HUD can take the budgets file and the quality line first (`<PerfHud budgets quality>` in the copy), so the swap to the drop-in changes no numbers.
- **Bundling**: the tools must stay in their own chunks. A manual chunking rule that sends all of `node_modules` to one eager `vendor` chunk pulls three-meter and three-audit into the first load, copies or drop-in alike; exclude `@zkmake` from it (the regex is in three-devtools' README, _Keep it out of the first load_), or let the bundler split dynamic imports itself. Fix it in this pass even before the drop-in lands: it's the copies' leak too. [verify.md](verify.md) checks the preloads.

## Studio

The page stays where it is (`mockups.html` or `studio.html`, never built), and so do the area and variant files. Only the shell changes, onto `@zkmake/three-studio`; follow the scene-mockups skill's [../../scene-mockups/references/mockup-page.md](../../scene-mockups/references/mockup-page.md) for a mockups page and the model-pass skill's [../../model-pass/references/studio.md](../../model-pass/references/studio.md) for a model studio.

- **The config** from the old page's tables: each area with its variants (label, render), the shared views from its camera code (`orbitViews(centre, near, { play })` or written poses), an area's or variant's own views where the old page had them (a camera area's variants each bring their poses).
- **URL keys**: three-studio reads `area`, `v`, `view`, `t`, `clean`, `wire`, `shots` and a bare `?<area>`. Keep links that the style guide, round folders and pass logs hold working: if the old page used other keys or view names, name the new views the same, or map the old keys in the page before `resolveStudio`.
- **The look**: the old page's `<Canvas>` props go to `canvas` (fixed `dpr` for steady shots), its lights, fog and ground to `stage`, a WebGL game on React Three Fiber 10 passes the legacy `Canvas`. An extra DOM layer a variant brought (a HUD over a moment) stays the variant's.
- **Animation**: the old page's frozen-time clock becomes `useStudioTime()`; `?t=` keeps working.
- **Out**: URL parsing, switchers, the orbit rig, the readout, the helpers effect, any shot code. `saveShot`, `three-studio serve`, `diff` and `montage` replace shot servers and compare scripts.

## Quality

Install `@zkmake/three-quality` as a regular dependency.

- **React Three Fiber**: the game's `<Canvas dpr={[1, 2]}>` becomes `<Canvas dpr={1}>` with `<AdaptiveQuality maxDpr={2} />` inside it: the old ceiling as `maxDpr`, the old floor as `minDpr` when it wasn't 1. Hand `qualityStore` to `<DevTools quality>`.
- **Vanilla**: `adaptQuality(renderer, { maxDpr })` in place of `setPixelRatio(…)`, its handle to `mountDevTools({ quality })`. A resize handler that called `setPixelRatio` again stops doing so.
- **Tiers** only for switches the app already has (shadows, post-processing, particle density), read with `useQualityTier(name)` or the tier's `set`. A new switch is a design change: propose it, don't add it here.
- **Studio and shots** keep a fixed ratio: the studio page doesn't mount the controller, and play-view shots of the game are taken at a pinned rung (`qualityStore.get()?.pin(0)`, or `adaptQuality(…).pin(0)`) so before and after compare.
