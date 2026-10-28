---
name: scene-mockups
description: Mock up more detail for one part of a three.js / React Three Fiber scene (props, scenery, characters, vehicles, backdrops) as variants built in the app itself, run a model pass on what's there, and publish a page to pick from; then build the picks into the app. Use when the user asks for mockups, variants or a richer look for part of a scene to choose from.
argument-hint: "[part of the scene]"
disable-model-invocation: true
---

# Scene mockups: variants to pick, built in the app

One **round** is: **scope → study → kit → mockups → capture → pass → picks page**, then the picks go into the app when the user pastes them back. The picks page is the deliverable.

Words used below:

- **Part**: the slice of the world this round improves: props, scenery and terrain, characters, vehicles, backdrops (menus, garages, showrooms), sky and light.
- **Area**: one thing inside the part that gets its own variants (for props: a grandstand, signs, gates).
- **Variant**: one look for one area, built as real scene code (`now` reproduces today's look; 2–4 others push further). Variants are scene code the app can adopt as it stands.
- **Mockup page**: a dev-only `@zkmake/three-studio` page in the app (`mockups.html`) that renders any area's variant in the app's own lights, fog and camera, with a draw-call and triangle readout.
- **Reference**: the project the user names for inspiration, whose techniques the variants borrow.
- **Style guide**: the app's `3D-STYLE.md`, as the model-pass skill keeps it: look, natures, budgets, studio, pass log.
- **Pick**: a variant or fix the user ticks on the picks page; the page copies the picks out as a prompt.

## 0. Scope

Ask the user, in one message, for what isn't already clear:

1. **Which part** of the scene this round is for. Offer the list from _Part_ above plus "something else"; the part the user named when invoking the skill answers it.
2. **Which reference** to take inspiration from: another project or a path. Without one, use the app's own best-built part.
3. **Which areas** inside the part matter most. Propose 2–5 from what the app shows; the user trims.

Then read the app's `AGENTS.md` (or `CLAUDE.md`) and its style guide. Without a style guide, run the model-pass skill's first-run setup first ([../model-pass/references/setup.md](../model-pass/references/setup.md)): it writes one.

Done when the part, the reference and the areas are settled with the user and the style guide is read.

## 1. Study the reference

Survey the reference read-only (in a subagent, if your agent has them): how it builds this part (geometry, variety, shading, placement, instancing and batching, materials, motion, studio tooling), with file paths and the constants that matter. Keep the report; quote it on the picks page as the source of borrowed tricks.

Done when every area has at least one technique from the reference named with its file, or a note that the reference has nothing for it.

## 2. Bring in three-kit

Read <https://zkmake.github.io/three-kit/llms.txt>, and the README of each package you'll call (`llms-full.txt`, or the installed `node_modules/@zkmake/<name>/README.md`, which wins on signatures). The packages this skill leans on:

| Package                                                 | Use here                                                                                                                                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@zkmake/three-studio` (dev)                            | the mockup page: areas, variants and views from the URL, the readout, `saveShot`, and the `three-studio serve / diff / montage` CLI                                                    |
| `@zkmake/three-audit` (dev)                             | `summary()`, `census()`, `zfight()`, `audit()`, `meshes()`, `ledger()` in the console; `/vitest` matchers and `defineBudgets` in tests                                                 |
| `@zkmake/three-batch` (runtime)                         | `chunkInstances` / `chunkMesh` culling cells for anything spread over the world, `bake` / `<Baked>` to merge many parts into a draw per material, `FollowBatch` for many moving copies |
| `@zkmake/three-meter` (dev)                             | the frame HUD, held to the budgets file                                                                                                                                                |
| `@zkmake/three-cameras`, `@zkmake/three-textures` (dev) | camera and texture inspectors when a view or a map misbehaves                                                                                                                          |

Install what the app lacks, the project's way (its package manager, version pins, catalog, release-age rules), and link `llms.txt` from the app's `AGENTS.md` and style guide.

Done when every package the variants will call is installed and typechecks, and the docs carry the link.

## 3. Build the mockups

Follow [references/mockup-page.md](references/mockup-page.md) to add the mockup page if the app has none, then one file per area under `src/mockups/`.

- **Measure before placing.** Read the bounds of the parts a variant attaches to (`bbox("<name>")` in the console, or `measureBounds` in a throwaway test) and stand every addition 5 mm proud of the surface it lies on.
- **`now` first**, built from the app's own code, so every other variant is judged against today in the same light.
- **Variants push in different directions** (subtle, rich, playful), and each one stays inside the style guide's palette, materials and natures. Borrow the reference's tricks by name.
- **Shared builders** go in one kit module; when a pick ships, its builders move into the scene and the mockups import them back, so the page never drifts from the app.
- **Cost as you go**: instance or merge anything that repeats; cut world-spanning instances into culling cells; read the page's readout for every variant.

Done when every area has `now` plus at least two variants rendering on the page without console errors, and the project's typecheck and linter are clean.

## 4. Capture

Follow [references/capture.md](references/capture.md): one play-view shot per variant (plus a close or wide view where detail or layout is the point), each variant's draws and triangles from the readout.

Look at every shot before keeping it: a variant hidden inside the body, facing away, or off camera gets fixed in code and shot again.

Done when every variant has its shots in a durable round folder in the project (`plans/<part>/mockups-<n>/`) and its numbers noted.

## 5. Model pass on what's there

Run the model-pass skill's _Baseline_ and _Audit_ steps ([../model-pass/SKILL.md](../model-pass/SKILL.md)) over the part as the live app draws it: `census()` for each geometry's count and triangles, `zfight()`, `audit()`, unnamed geometries, the frame's real draws and triangles (`ledger()`, [references/capture.md](references/capture.md)), each object's count from its placement code. Each cost, fight or unnamed mesh becomes a finding with its evidence and a fix.

Done when every object in the part has its line (triangles × count, draws) and every finding has a measured number behind it.

## 6. Picks page

Build one self-contained HTML page from this round (publish it where the user can open it: a hosted page, a static host, or the round folder), with these sections:

- **Answer first**: what the round found and the recommended picks.
- **Gallery**: every capture, `now` beside each variant, pins on the problems.
- **Findings** `F1…`, ranked: what looks weak or costs too much, with evidence.
- **Variants** `V…`, grouped by area (pick one per area unless they stack), each with its capture, what changes, files touched, and its cost against the budget.
- **Fixes** `S…` from the pass: cheaper, cleaner, named.
- **Picks**: a tick per variant and fix, and a button that copies the ticked ones as a prompt ("Build V2, V5 and S1 from mockups round 3") for the user to paste back.

Done when the page opens with every image showing, the copy button produces the prompt, and the user has the link with the recommended picks in one line.

## After the picks come back

1. Build each pick into the app's real scene modules (not the mockup files), promoting its builders out of `src/mockups/`.
2. Measure the app's frame (`ledger()` on each screen that matters) against the budgets file; `zfight()` and `audit()` stay empty.
3. Add tests for new geometry with `@zkmake/three-audit/vitest`: `toHaveCleanGeometry()` and `toHaveNoZFighting()` over the new parts, `toFitBudget(budgets.parts.<kind>)` per kind, and a colour on every vertex where the style merges by colour.
4. Update the style guide (natures, the reasons behind changed budgets, a pass-log row with before/after numbers) and the app's `AGENTS.md`.
5. Commit only this round's paths, then report with the numbers and ask before deploying.

Done when every pick is in the app, verified in the browser, the checks are green, and the docs carry what changed.
