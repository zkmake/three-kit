# First run: style guide, budgets and studio

Runs once per project, when no `3D-STYLE.md` exists. It produces what every later pass stands on: the **style guide** (what this world looks like and why it costs what it does), the **budgets** file (how much it may cost), and the **studio** (where it is measured). Work in order; each step feeds the next.

## 1. Survey

Read the project; change nothing. Fill every _Survey_ fact in [style-template.md](style-template.md), each with the file it came from:

- **Stack**: vanilla three or R3F (plus drei, post-processing, physics), the three version, the bundler and dev command, the package manager and how it pins versions.
- **Units**: what one world unit is (metres unless the code says otherwise). three-audit's gaps assume metres.
- **Renderer**: output colour space, tone mapping, shadows (type, map size), post-processing (bloom especially: it turns NaN pixels into black blocks), antialiasing, DPR cap.
- **App camera**: position relative to its target, fov, near/far, and the distance range it actually plays at. From that, pixels per world unit at play distance at a 1200 × 800 viewport. This number decides what detail is ever visible.
- **Materials and palette**: shared material factories, palette constants, custom shaders (which are keyed to world space, which to local), texture use.
- **Multiplication**: what is instanced (`InstancedMesh`), batched (`BatchedMesh`), merged (`mergeGeometries`, bakes), and what is placed one by one. What merge steps skip (text, animated parts).
- **Objects**: every distinct modelled thing, its nature, and how many the world holds.
- **Kit**: which `@zkmake/*` packages are installed, and whether the app already installs three-audit's helpers or a three-meter HUD in dev.
- **Look today**: screenshots of the running app from its own camera ([verification.md](verification.md), _Screenshots_; an app may need a click or key to start). Look at them before writing a word about the style.

Done when every _Survey_ fact is filled with a source path or marked "none", and the screenshots are on disk.

## 2. Settle the style

Draft the style guide's _Look_, _Natures_ and _Budgets_ sections from what the survey found: most projects already have a style, only unwritten. Then settle it with the user, one round per message, each question carrying the default the survey suggests in parentheses. Accept "defaults" for the rest of a round.

**Round 1: the look**

- The world in one line, plus any references (games, films, artists, photos)?
- Palette and value register: which colours carry the eye, which recede (e.g. bleached ground, saturated hero)?
- Faceted low-poly, smooth, or mixed by nature?

**Round 2: construction**

- Per nature present in this project: faceted or creased, smooth or hard-edged, and the crease angle (32°)?
- Surface detail (rivets, planks, grain, strata) in shaders or in geometry (shaders)?
- Any nature this project has that [natures.md](natures.md) lacks (vehicles, architecture, characters, UI-in-world)?

**Round 3: cost**

- Target hardware and frame rate (mid laptop, 60 fps)?
- Frame budget: triangles per frame and draw calls (derive from the survey's current counts)?
- Per-part ceilings for the objects that matter, and per-instance ceilings for anything multiplied by hundreds?

With a greenfield project and no look to infer, propose one concrete direction from the premise and camera, and let round 1 correct it.

Done when the user approves the drafted _Look_, _Natures_ and _Budgets_.

## 3. Build the studio

Follow [studio.md](studio.md): a dev-only entry, lit like the app, one area for an existing object, the play view.

Done when, in the browser, the studio shows that object from the play view, `saveShot()` writes a PNG of it, and `summary()`, `zfight()` and `audit()` all return values from the console.

## 4. Write the budgets and the style guide

- **Budgets**: `src/budgets.ts` (beside the app's source) from `defineBudgets` in `@zkmake/three-audit/budgets`, with the settled `frame` and a `parts` entry per object that has a ceiling. If the app shows a three-meter HUD, pass it the same file (`budgets`).
- **Style guide**: `3D-STYLE.md` at the root of the package that depends on `three`, from [style-template.md](style-template.md): the survey facts, the settled look, natures and the reasons behind each budget, the studio's start command, areas and views, and today's numbers from `summary()` / `meshes()` on the play view as the first _Pass log_ row.

Add one pointer line to the project's `AGENTS.md` (or `CLAUDE.md` when that is what it has), so every agent doing 3D work reaches the guide, not only this skill:

```md
- 3D look, natures, budgets and the model studio: read `3D-STYLE.md` before modelling or adding scene content.
```

Done when the style guide exists with no empty sections, the budgets file typechecks, the pointer line is in place, and the user has seen the guide. Return to SKILL.md step 0 if the user named an object to pass.
