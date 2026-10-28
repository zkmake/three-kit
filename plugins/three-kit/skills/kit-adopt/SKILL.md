---
name: kit-adopt
description: Move one three.js / React Three Fiber app onto the three-kit packages in one pass. Surveys what it carries by hand (debug and perf-meter copies, a studio or mockups shell, hard-coded budgets and pixel ratio, triangle-count test helpers), swaps each for its package (a defineBudgets file with toFitBudget tests, one DevTools drop-in behind ?debug, a three-studio page, three-quality), removes what's dead, verifies nothing changed on screen, and reports lines removed and what the app gained. Use when the user asks to adopt the kit, move an app onto three-kit, or replace an app's copied debug, studio or budget code.
argument-hint: "[app]"
disable-model-invocation: true
---

# Kit adopt: one app onto the packages, in one pass

One pass is: **survey → baseline → budgets → dev tools → studio → quality → prune → verify → report**, for one **app**. The other skills build things; this one takes out what an app copied before the packages existed and puts the package in its place, so the next model pass, mockup round or perf pass starts on the kit. Nothing on screen should change: the play view before and after is the check.

Words used below:

- **App**: the one the user named when invoking the skill; in a monorepo, one workspace.
- **Copy**: code the app carries that a package now does: a `?debug` switch with a perf HUD, console helpers wired by hand, a studio or mockups shell (URL parsing, switchers, orbit rig, readout), budgets written into a file, a hard-coded pixel ratio, test helpers that count triangles.
- **Swap**: one copy out, its package in, with the app's own choices kept (HUD placement, storage keys, URL keys, views, numbers).
- **Budgets**: the app's `defineBudgets` file (`src/budgets.ts`, from `@zkmake/three-audit`): `frame` is the target, `parts` the ceilings its tests hold.
- **Style guide**: the app's `3D-STYLE.md`, as the model-pass skill keeps it. Its _Budgets_ say why each number is what it is.
- **Play view**: what the player sees, at each play position the perf-pass skill names (start, the busiest moment, each level or screen), and the studio's `play` view of each area.
- **Ledger of lines**: each copy's files and line count before, and what replaced it after. The report's first table.

The tools are the `@zkmake/*` packages. This skill names their calls; the installed package's README (`node_modules/@zkmake/<name>/README.md`, or <https://zkmake.github.io/three-kit/llms-full.txt>) is the authority on their signatures. Paths below are relative to this skill's directory.

## 0. Survey

Read the project's and the app's `AGENTS.md` (or `CLAUDE.md`) and style guide first: how it installs packages (catalog, exact versions, release-age rules), which scripts it runs and which it never runs by hand, and what other work is uncommitted in the tree (leave it alone).

Follow [references/survey.md](references/survey.md): find every copy, count its lines, and name the swap for each. Read the installed `@zkmake/*` versions against the latest releases.

Done when the ledger of lines has a row per copy (files, lines, the package that replaces it), every swap is either planned or marked "keep" with the reason (an app-specific tool no package offers), and the user has seen the plan in one message.

## 1. Baseline

Before a line changes, follow [references/verify.md](references/verify.md) _Before_: shots of the play view at every play position and of every studio area's `play` view, the frame's draws and triangles there (`ledger()`), the bundle's entry size, and the state of the typecheck, lint, tests and build (a check that fails before the pass is noted, not fixed silently).

Done when the before shots and numbers are on disk in a durable folder (`plans/<app>/kit-adopt/`).

## 2. Budgets

Follow [references/swaps.md](references/swaps.md) _Budgets_:

- `src/budgets.ts` with `defineBudgets`: `frame` from the style guide's _Budgets_ (the numbers the copies hard-coded are usually the same; where they disagree, ask). `parts` for each kind the tests build, seeded from today's measured triangles with the headroom the style guide gives, never below today.
- Tests: each hand-written triangle count or ceiling becomes `toFitBudget(budgets.parts.<part>)` from `@zkmake/three-audit/vitest`; new or touched geometry also gets `toHaveCleanGeometry()` and `toHaveNoZFighting()`. A failing matcher on today's geometry is a finding to report, not a ceiling to raise.
- The style guide's _Budgets_ points at the file and keeps the reasons.

Done when the budgets file typechecks, the tests read it, and no test counts triangles by hand.

## 3. Dev tools

Follow [references/swaps.md](references/swaps.md) _Dev tools_: one `@zkmake/three-devtools` drop-in in place of the app's `?debug` copies. React Three Fiber: `<DevTools />` inside the app's `<Canvas>`; vanilla: `mountDevTools` and its `wrap` on the loop. It takes the budgets file, the app's quality source, `dev` from the build, the copy's HUD placement and storage key, and only the panels the app already showed.

Done when the copies are deleted, nothing imports them, and `?debug` shows the HUD with the budgets file's lines while a normal load fetches none of the tools (the bundle check in [references/verify.md](references/verify.md)).

## 4. Studio

Follow [references/swaps.md](references/swaps.md) _Studio_: the app's studio or mockups page onto `@zkmake/three-studio` (`<Studio>` or `mountStudio`), keeping its areas, variants, views and URL keys, so links in the style guide and old round folders still open the same thing. The area and variant files stay; only the shell goes.

Done when every area and view the old page had opens on the new one, its readout fills, and the console helpers answer.

## 5. Quality

Follow [references/swaps.md](references/swaps.md) _Quality_: a hard-coded pixel ratio (`dpr={[1, 2]}`, `setPixelRatio(Math.min(devicePixelRatio, 2))`) becomes `@zkmake/three-quality`, its old ceiling as `maxDpr`, tiers only for switches the app already has. Its source goes to the dev tools' `quality`.

Done when no hard-coded ratio is left on a game canvas (the studio page keeps a fixed one, for shots) and `?debug` shows the quality line.

## 6. Prune

Remove what the swaps left dead: the copies' files, their imports, helpers only they used, direct dependencies the app no longer imports (a package the drop-in brings needs no direct dependency unless the app imports it too), lines in `AGENTS.md` and the style guide that describe the copies. Add the packages to the docs the project keeps (`AGENTS.md` lines, the style guide's _Studio_ and _Budgets_, the `llms.txt` link).

Done when a search for each copy's names and paths finds nothing outside history and plans, and the docs name the packages instead.

## 7. Verify

Follow [references/verify.md](references/verify.md) _After_: the project's typecheck, lint, tests and build green; in a browser, the app without `?debug` (no tool chunks fetched), with `?debug` (HUD, budgets, quality line, `tris()` and `ledger()` in the console, the panels the app asked for), and the studio (each area, readout, `saveShot`); the play view at every play position and studio area diffed against the baseline with `three-studio diff`, and a `three-studio montage` of the pairs.

Done when every check is green and every play-view diff reads as identical (about 0.1% of pixels or under, nothing in the diff mask). A diff that isn't is a swap that changed something: find which and fix it before going on.

## 8. Report

Commit only this pass's paths, the project's way. The report opens with the ledger of lines:

| Copy | Files | Lines before | Replaced by | Lines after |
| ---- | ----- | ------------ | ----------- | ----------- |
|      |       |              |             |             |

Then the total removed, what the app gained (budgets its tests hold, a HUD that reads them, adaptive pixel ratio, lazy tools confirmed by the bundle, the studio's shots and diffs), the dependencies added and dropped, the play-view diffs and montage, and anything kept as a copy with its reason. A package gap found on the way (a copy no package covers yet) is named as a follow-up for the kit, not built into the app.
