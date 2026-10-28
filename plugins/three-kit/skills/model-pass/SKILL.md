---
name: model-pass
description: Remodel one three.js / React Three Fiber object at a time for silhouette, topology, triangle budget and z-fighting, measured in a model studio and verified with screenshots against the project's 3D style guide. Use when the user asks for a model pass on an object, or to remodel, clean up or cut the triangles of one model.
argument-hint: "[object]"
disable-model-invocation: true
---

# Model pass: one object at a time

Loop: **baseline → remodel → audit → distance → verify**, run on one object per pass. Every number is measured in the **studio**, never estimated; every claim of "fixed" is a studio screenshot or a helper's output.

Words used below:

- **Style guide**: the project's `3D-STYLE.md`, the single source of truth for how this world looks and why it costs what it does. Every pass reads it; every pass that learns something writes it back.
- **Budgets**: the project's `defineBudgets` file (`src/budgets.ts`), the numbers tests, the CLI and the HUD hold the scene to. The style guide says why; the file says how much.
- **Studio**: a dev-only page built on `@zkmake/three-studio` that mounts one object at the origin, lit like the app, with named camera **views**, a draw-call readout, and three-audit's console helpers (`summary`, `tris`, `meshes`, `census`, `zfight`, `audit`).
- **Play view**: the studio view copied from the app's own camera (bearing, lens, distance). It is what the player or viewer sees, so it judges every trade.
- **Nature**: what kind of thing the object is (machine, creature, plant, ground). It decides how the object is built, shaded, animated and multiplied.
- **Fight**: a pair of parts with faces in one plane, facing the same way, overlapping. `zfight()` lists them.
- **Numbers table**: the before/after measurements that open every report.

The tools are the `@zkmake/*` packages. This skill names their calls; the installed package's README (`node_modules/@zkmake/<name>/README.md`, or <https://zkmake.github.io/three-kit/llms-full.txt>) is the authority on their signatures. Paths below are relative to this skill's directory.

## 0. Style guide and studio

Find the style guide: `3D-STYLE.md` at the root of the package that depends on `three`.

- **Missing**: this is the first run. Follow [references/setup.md](references/setup.md) end to end before touching any object. It surveys the project, settles the style with the user, builds the studio, and writes the style guide and budgets.
- **Present**: read it whole. Its _Studio_ section says how to start the studio and which areas and views exist; its _Budgets_ and _Natures_ sections bound this pass.

Then settle the object with the user if they didn't name one when invoking the skill. One object per pass; a family of variants (every tree kind) counts as one.

Done when the style guide is read and the studio renders the object in the browser ([references/verification.md](references/verification.md), _Screenshots_).

## 1. Baseline

- The object has its own studio area, so it mounts alone inside the group three-studio tags `userData.studioObject = "<area>-<variant>"`. If it has none yet, add one ([references/studio.md](references/studio.md), _Adding an object_).
- Look at every view's screenshot before trusting it. A view whose camera misses the object, sits inside it, or looks end-on measures nothing.
- Record, before editing a line: shots of a close view and the play view; `summary("<tag>")` (triangles, draws, meshes, fights, bad geometry); `studio.stats()`; and **how many of it the world holds**, counted from the real placement code, not guessed. A rare-looking object can be numerous: count before calling it cheap.

Done when the before-state is on disk: shots in the pass folder, and every row of the numbers table (step 5) filled for _Before_.

## 2. Remodel

Read the object's nature in the style guide, then its section in [references/natures.md](references/natures.md), before drawing a vertex. Read [references/gotchas.md](references/gotchas.md) once per session.

Whatever the nature:

- **Shape first.** The silhouette from the play view is what the viewer sees. Spend triangles where they change that outline or its shading; spend none on flat faces or hidden undersides. A lower count with a truer shape beats a higher one.
- **Topology for shading.** Even, well-proportioned faces whose edges follow the form: rings round a round thing, lines along a long one. A curved surface gets enough faces across it to shade smooth; a hard edge gets a crease (split normals); nothing in between. Weld what should be one surface.
- **Respect the fit.** Keep its proportions and every point other code reads: exported constants, colliders, pivots, attach points, hit points, animation.
- **One world.** Build from the style guide's shared materials and palette so it reads as part of the same place. Detail with no silhouette (rivets, planks, seams, grain) goes in the shader: zero triangles.
- **Name every mesh and geometry.** `meshes()`, `census()` and every fight report by name.
- Check the wireframe (`&wire=1`): it shows the topology you meant.

Done when every part the object had is rebuilt or deliberately kept, and the close and play shots read as one object true to its nature and the style guide.

## 3. Audit

- `zfight()` returns `[]`. Fix each fight at the source: stand the smaller part ≥ 5 mm off, shorten it inside the larger one, or fit panels between each other rather than over each other's ends. A pair that is a real collision (one part through another) gets moved, not nudged. Merged geometry: `zfight(0.004, true)` checks within one mesh.
- `audit()` returns `[]`: no NaN positions, no zero normals. Either lights a pixel NaN, and bloom smears that into a black block.
- Anything wrapping other geometry (a chain, rope, strap, vine) is built from the surface it hugs and checked close up; `clearance(a, b)` measures the gap.
- The object gets a test, built the way the app builds it, with `@zkmake/three-audit/vitest`: `toHaveNoZFighting()`, `toHaveCleanGeometry()`, and `toFitBudget(budgets.parts.<object>)` once the budgets file lists it.

Done when both helpers return `[]`, the close-up shows nothing passing through anything, and the test is green.

## 4. Distance

- Decide what the object is ever seen from, using the style guide's play distance.
- **Far copy**, when the object is seen both close and far: `simplifyReport(scene, [e1, e2, e3])` from `@zkmake/three-batch/lod` shows what simplifying the tagged object to each error would leave ([references/studio.md](references/studio.md), _Far copies_). Something only ever seen from the play camera can ship the simplified mesh as its only geometry. Animated geometry keeps the rings its motion bends around. Near and far at the play view differ by a fraction of a percent of pixels (`three-studio diff`).
- **Cells**: a static `InstancedMesh` or merged geometry spread over the whole world is culled as one, so every instance draws every frame. Split it with `chunkInstances` / `chunkMesh` from `@zkmake/three-batch`, unless its instances move. In `meshes()`, a world-spanning name with no `#<cell>` suffix is a mesh nothing culls.

Done when triangles at play distance × instance count are measured and at or below the baseline, or the increase is stated and justified against the budget.

## 5. Verify

Follow [references/verification.md](references/verification.md) for each item:

- One before/after comparison image (close and play views) sent to the user.
- If the pass added new kinds of geometry to anything that moves or glows, the black-frame check in a visible browser: 0 black frames.
- The project's typecheck, lint, tests and build all green (commands from `package.json`).
- The style guide updated in place: a new rule or pitfall this pass taught, a budget changed in the budgets file with its reason in the guide, and a row in its _Pass log_. The object's own notes (its doc comment or `AGENTS.md` bullet) updated if the project keeps them.
- The report to the user opens with the numbers table, on every pass and every follow-up tweak, with _Before_ as the state before this change:

  |                                                        | Before | After |
  | ------------------------------------------------------ | ------ | ----- |
  | Triangles, one (at play distance if it has a far copy) |        |       |
  | How many the world holds                               |        |       |
  | Triangles, the world's worth                           |        |       |
  | Draw calls                                             |        |       |
  | `zfight()` pairs                                       |        |       |
  | `audit()`                                              |        |       |

  A row that doesn't apply says so rather than being dropped.

Done when the user has the comparison image, the numbers table, `zfight()` and `audit()` at `[]`, green checks, and the style guide carries what this pass learned.
