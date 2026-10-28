---
name: perf-pass
description: Fit a whole three.js / React Three Fiber frame to the project's budgets, one area at a time. Surveys draws and triangles at every play position, ranks areas by what the frame really draws, and takes the costliest through the cheapest fix that keeps the look, verified by pixel diff.
argument-hint: "[area]"
disable-model-invocation: true
---

# Perf pass: the frame, one area at a time

Loop: **survey → rank → pass → write back**, one **area** per pass, until the **frame** fits the **budgets** at every **play position**. The model-pass skill works on one object; this one works on the frame: what the play camera actually draws, in every pass, from where the player actually stands. Every number is measured in the running app, never estimated; every "looks the same" is a pixel diff and a look at the shots.

Words used below:

- **Frame**: one rendered frame as the draw **ledger** records it (three-audit's `ledger()`): every draw call by object and pass, with its triangles. The scene's totals (`tris()`, `census()`, `summary()`) are the _world's worth_, culled or not; they explain a cost, the ledger measures it.
- **Play position**: a place in play the player sees the scene from: the app's own camera at a height, moment, level or screen. The frame changes with each; a pass is judged at all of them.
- **Area**: one ledger group or scene part that costs as one thing (the city, the forest, the wires, the shadow pass). One area per pass.
- **Budgets**: the project's `defineBudgets` file (`src/budgets.ts`): `frame` is the target, `parts` the ceilings tests hold.
- **Style guide**: the project's `3D-STYLE.md`, as the model-pass skill keeps it. Its _Budgets_ say why, its _Pass log_ records every pass.
- **Studio**: the project's `@zkmake/three-studio` page; a pass gives its area a mode and views there.
- **Baseline table**: the survey's numbers, one row per play position, kept for the whole loop.

The tools are the `@zkmake/*` packages. This skill names their calls; the installed package's README (`node_modules/@zkmake/<name>/README.md`, or <https://zkmake.github.io/three-kit/llms-full.txt>) is the authority on their signatures. Paths below are relative to this skill's directory.

## 0. Style guide, budgets, helpers

- Read the style guide whole. Missing: run the model-pass skill's first-run setup ([../model-pass/references/setup.md](../model-pass/references/setup.md)) first; it writes the guide, the budgets and the studio.
- The budgets file exists and its `frame` holds the target (fps, calls, triangles). Missing: write it from the guide's _Budgets_ with `defineBudgets`, and pass it to the app's three-meter HUD (`budgets`).
- three-audit's helpers are on the **app's** scene in dev, with its renderer (`installAuditHelpers(scene, { renderer })`), so `ledger()` runs in the game itself, not only in the studio.
- Settle the play positions with the user: propose them from the camera code and the game's flow (start, the busiest moment, each height or level, the end), and how to reach each one from a URL or a console call.

Done when the budgets file typechecks with a `frame`, `ledger()` answers in the running app, and every play position has a way to reach it.

## 1. Survey

Follow [references/survey.md](references/survey.md) at every play position: one frame's draws and triangles per pass and per area, the world's worth beside it, and heap, requests and bytes where the browser gives them.

Done when the baseline table has a row per play position, each with its frame triangles and draws (both passes), its top areas, and where it stands against `frame`.

## 2. Rank

- Rank areas by what the frame draws of them, summed over every pass, at the play positions that are over budget or nearest it. An area that tops every position comes first.
- Break the top area down until the cause has a name: which geometry, how many copies, at what distance from the camera, in which pass ([references/survey.md](references/survey.md), _Breaking an area down_). Triangles × copies drawn is the cost; a cheap-looking piece can be numerous.
- Check the frame, not the world: something the camera never sees costs nothing once culled, and something culled for the world can still draw in the frame (one bounds over the whole world, past the fog, in the shadow pass).

Done when the area for this pass is picked (`$ARGUMENTS` names it when given) and its cause is stated with numbers: "cars: 22 drawn past 170 at 1,250 triangles each, 33% of the city".

## 3. Pass

- **Studio first.** The area has a mode in the studio, rendered by the app's own code, and views at its play positions; add them ([../model-pass/references/studio.md](../model-pass/references/studio.md)). A far level shows best through a long lens: a view standing at the play distance with a narrow fov draws the level the game draws there, magnified.
- **Before**: shots of every view the fix could change, taken before a line changes ([../model-pass/references/verification.md](../model-pass/references/verification.md)).
- **The cheapest fix that keeps the look**: find the symptom in [references/fixes.md](references/fixes.md) and take its first fix that holds the look from every play position. Use the kit's calls; build only what they lack.
- **After**: the same shots, `three-studio diff` at every play view, a `three-studio montage` of before and after, and the survey again at every play position.

Done when the area's frame cost is down at every play position where it drew, the play-view diffs read as identical (about 0.1% of pixels or under, and nothing visible in the diff mask or the montage), and no other area's numbers rose unexplained.

## 4. Write back

- **Budgets**: a `parts` entry for what this pass fixed, and a test that builds it the way the app does and holds it there with `@zkmake/three-audit/vitest`: `toFitBudget(budgets.parts.<part>)`, plus `toHaveCleanGeometry()` and `toHaveNoZFighting()` for any new geometry. `frame` changes only with the user.
- **Style guide**: a _Pass log_ row (the area, its triangles before → after, the frame at each play position before → after, draws, the diff), a pitfall for anything the pass tripped on, and the budget's reason under _Budgets_. The area's own notes (doc comment, `AGENTS.md` bullet) updated if the project keeps them.
- The project's typecheck, lint, tests and build green.
- The report opens with the numbers table, then the montage:

  | Play position | Frame triangles, before → after | Draws, before → after | The area, before → after |
  | ------------- | ------------------------------- | --------------------- | ------------------------ |
  |               |                                 |                       |                          |

  Then the play-view diffs, and any cost the fix moved elsewhere (bytes, requests, heap, draws).

Done when the budgets file, the test, the style guide and the report all carry this pass.

## 5. Again, or stop

Re-rank from the new survey and take the next area. Stop when the frame fits `frame` at every play position. Otherwise, when the next fix would cost the look or more than it saves, stop and say what remains, at which positions, and why: the next ranked area, its cost, and the fix it would take.
