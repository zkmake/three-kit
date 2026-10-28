# Contributing

A Bun workspace run by Turborepo, set up like `edtech-apps`: published packages in `packages/`, the
site in `apps/site`, shared config in `configs/`. One `bun install` at the root sets them all up, and root
scripts run each task in every workspace, in dependency order, cached by turbo.

```sh
bun install
bun run ci-local       # everything CI runs: format, lint, typecheck, test, build, pack
bun run build          # packages (tsdown, then publint and arethetypeswrong) and the site (astro)
bun run ci:typecheck   # tsc in every workspace
bun run ci:test        # vitest in every workspace
bun run lint:fix       # oxlint
bun run format:fix     # oxfmt
bun run dev            # the site with hot reload, https://three-kit.localhost/three-kit/
```

To run one workspace, filter: `bunx turbo run build --filter=@zkmake/three-meter`, or run its script
from its folder.

## Versions: the catalog

Shared dependency versions (three, React, r3f, their types, Vite, Vitest, tsdown, TypeScript) are
pinned once in the root `package.json` under `workspaces.catalog`. Workspaces depend on them with
`"catalog:"`, so bumping three is one line.

tsdown stays at 0.23.1 while TypeScript is 7.0: 0.23.2 moved to rolldown-plugin-dts 0.29 (beta),
whose `tsgo` generator needs TypeScript 7.1's API and whose `tsc` generator refuses TypeScript 7,
so every package's declaration build fails. Bump both together.

One rule for published packages: use `catalog:` and `workspace:*` only in `devDependencies`.
Changesets publishes with plain `npm publish`, which copies both specifiers into the published
`package.json` unresolved. Consumers never install a package's dev dependencies, so there they're
harmless (checked by installing a packed tarball with npm and Bun), but in `dependencies` or
`peerDependencies` they would break installs. Keep those as explicit ranges, and keep peer ranges
wide. Before one package depends on another, add a step that resolves `workspace:*` before
publishing, or switch the workspace to pnpm.

## Shared config

- `configs/typescript` (`@config/typescript`): `tsconfig-lib.json` for packages, `tsconfig-app.json`
  for apps. Apps extend it by package name; published packages extend it by relative path, so their
  `package.json` stays free of private workspace dependencies.
- `oxlint.config.ts`, `oxfmt.config.ts`, `bunfig.toml`, `turbo.json`, the changesets config and the
  workflows live at the root.
- `docs/` holds the images package READMEs load. Keep existing files at their paths: READMEs of
  published versions link to them on `main`.

## three-meter

- `src/core` holds `PerformanceMonitor`, the GPU timer, the frame stats and the scene-cost walk. No
  DOM, no deps. The renderer contract is the structural `PerfRenderer` type, and
  `tests/renderer-types.ts` pins it against three's real `WebGLRenderer` and `WebGPURenderer`.
- `src/ui` holds the DOM card, the dock, the settings and the injected stylesheet. No runtime deps.
- `src/react` holds the React Three Fiber adapter. Peer deps only.

`three` is a devDependency for the type pin and must stay out of `dependencies`.

Its demo is `apps/site/src/demos/three-meter`, at zkmake.github.io/three-kit/three-meter/demo, with both the
vanilla three and the React Three Fiber integration.

## three-audit

- `src/` holds the checks, one per file with its test beside it. No runtime deps: objects are
  recognised by three's `is*` flags and three is imported for types only. `three` is a
  devDependency for the tests (real scenes in Node) and a peer for consumers' types.
- The geometry checks must keep running in Node with no renderer; `tests/ssr.test.ts` guards the
  import. `tests/renderer-types.ts` pins the structural renderer types against `WebGLRenderer`.
- `src/node` loads glTF in Node (textures stripped, every buffer packed into one in-memory GLB so
  three's `FileLoader` never runs; Draco through an in-process `draco3dgltf` shim). `src/cli.ts` is
  the `three-audit` bin, left out of `exports`; its logic is `src/cli/main.ts`, which the tests
  drive. `tests/fixtures` holds a real exported GLB and a Draco one.
- `src/define-budgets.ts` is the `./budgets` entry: `defineBudgets` and `parseBudgets` with no imports,
  so an app's budgets file costs its first load a few hundred bytes. Keep it import-free; `checkBudget`
  (which measures) stays in `budgets.ts`.
- The model-pass skill's studio helpers are the origin; the plugin's skills install this package.

## three-batch

- The core (`src/*.ts`) imports three only. `src/lod` alone imports meshoptimizer and `src/react`
  alone imports React and R3F; all three are optional peers, so keep those imports in their entries.
- `FollowBatch` updates from its batches' `onBeforeShadow` / `onBeforeRender`. three's
  `onBeforeShadow` calls `onBeforeRender` with the shadow camera, so the wrapper calls three's
  prototype `onBeforeRender` directly; the test pins this.
- React tests use `@react-three/test-renderer` in Node, under StrictMode.
- Origin: keyboard-express's `chunked.ts`, `lod.ts`, `baked.tsx`, `train-batch.tsx` and wheel pool.

## three-textures

- `src/core` is the engine (`TextureLab`): discovery, swaps (in place for images, rebinding an image
  twin for compressed and data textures), GPU readback, IndexedDB persistence, live file links.
  `src/ui` is the panel (docked with three-meter's `dockPanel`, a regular dependency with an explicit
  range); `src/react` is `<TexturePanel />`.
- Readback writes rows so a PNG uploads back unchanged: flipped for `flipY` textures (not for
  `ImageBitmap`, which WebGL never flips), in upload order otherwise; sRGB re-encoded.
- Its demo is `apps/site/src/demos/three-textures` (zkmake.github.io/three-kit/three-textures/demo): a vanilla
  and a React Three Fiber version of one scene, with the three-meter HUD beside the panel. Its
  textures are original and committed; `bun run textures` in `apps/site` remakes them (needs ImageMagick):
  `crate.webp`, and `stickers.ktx2`, a Basis ETC1S atlas whose tiles say TOP, so a swap or readback
  that lands upside down shows. Round trip (download a texture, drop it back) should change nothing.

## The site

`apps/site` is the site at zkmake.github.io/three-kit/: an Astro build under the base `/three-kit/`,
deployed to GitHub Pages by the `pages` job in `ci.yml` on every push to main that passes the
checks. Every link and asset goes through `url()` in `src/paths.ts`, never a root path. In dev the
site is at `https://three-kit.localhost/three-kit/`: `bun run dev` goes through
[portless](https://github.com/vercel-labs/portless), which gives it that name on a free port. Run
`sudo portless trust` once so the browser trusts its certificate. `bun run dev--off` in `apps/site`
is plain `astro dev` on `localhost:3020/three-kit/`, for tools that need a fixed port. Astro runs
one dev server per project: while one is up, another `dev` or `dev--off` prints "Dev server already
running" and exits, so stop the first (or pass `--ignore-lock`).

One page per package, listed in `src/libraries.ts`:

- Every package's page, `/<name>/`, is its README (`src/pages/<name>/index.astro`, through
  `src/layouts/Readme.astro`). A package with a demo also gets it full screen at `/<name>/demo/`
  (`src/pages/<name>/demo.astro`). The header's tabs (`Bar.astro`) are the same on each: Docs, and
  Live demo where there is one. `/<name>/docs/`, where a demo package's README used to be, forwards
  to `/<name>/` (`src/pages/[library]/docs.astro`). READMEs render from the package's own file, and
  `src/readme-links.ts` points their relative links at the site or GitHub. Link a demo as
  `https://zkmake.github.io/three-kit/<name>/demo/`.
- A demo is `src/demos/<name>/`: `vanilla.ts` and `r3f.tsx` mount the same scene, `main.ts` hands
  them to `startDemoPage` (`src/scripts/demo-page.ts`), which runs the integration switch, the
  theme and the install card. Both load on demand, so a page fetches only the one it shows.
- The packages resolve to their `src/` (Vite `resolve.alias` in `astro.config.ts`, tsconfig
  `paths`), so editing a library hot-reloads with no build step.
- Each package has a lemon mark, `public/<name>/favicon.svg`, and the kit's is `public/favicon.svg`;
  `bun run icons` renders the PNG icons from them (needs ImageMagick).
- The landing page's hero scene is `src/scripts/hero.ts`, loaded after first paint. Its cards show
  `public/<name>/preview.mp4` for a package with a demo, recorded from the deployed demo by
  `bun run previews` (needs `agent-browser`, ffmpeg and `cwebp`), and a drawing in
  `src/components/CardMedia.astro` for the others.
- `llms.txt`, `llms-full.txt` and `/<name>/README.md` serve the docs as markdown for coding agents
  (`src/llms.ts`). The package lines and READMEs come from `libraries.ts` and the packages' own
  files, but the kit summary at the top of `src/llms.ts` is written by hand: update it with any
  change it describes (a package added or removed, renderers or React support, entry points). A
  README's relative link that isn't a sibling package (`../three-audit`) stays relative there, so
  write other links absolute.
- ⌘K / Ctrl K, "/" or the header's Search button opens a search palette, ported from zubin.dev's:
  Base UI's Autocomplete in a Dialog (`src/search/command-menu.tsx`), matched by `src/search/rank.ts`
  (tested). `src/scripts/search.ts`, on every page, loads it on first use. Its index is
  `search.json` (`src/pages/search.json.ts`): pages, packages, every README `##` / `###` section
  (found by the API names it mentions too) and links out, all from `libraries.ts` and the READMEs,
  so a new package or section shows up with no extra step. Commands (theme, copy link, copy an
  install command) live in `src/search/palette.tsx`; a leading `>` lists only those.
- `bun run og` renders each page's share image (`og.png`) as HTML with a picture of the package at
  work, taken from the deployed site (`SITE=https://three-kit.localhost/three-kit` for `bun run dev`). Needs
  `agent-browser`, ImageMagick and JetBrains Mono. Run it after a change to the landing page, a
  demo or a card's words in `scripts/make-og.ts`.

## three-studio

- `src/core` is the page state and no DOM at import: `resolveStudio` reads the URL against the
  config (pure, tested), `orbitViews` / `applyView` are camera poses, `frame.ts` the readout and
  wireframe, `capture.ts` `saveShot` and the hidden-pane frame shim. `src/ui` is the overlay and
  `mountStudio` (OrbitControls, three-audit's console helpers, `window.studio`); `src/react` is
  `<Studio>` and `<StudioRig>`, which mount it. `src/node` is the shot receiver and the PNG tools
  (Node's zlib only), `src/cli.ts` the `three-studio` bin, its logic in `src/cli/main.ts`.
- `@zkmake/three-audit` is a regular dependency with an explicit range, like three-cameras on
  three-meter.
- `saveShot` draws through the page's `render` and reads in the same task, so it needs no
  `preserveDrawingBuffer` and works in a hidden pane. The receiver writes `.png` only, inside its
  folder, on 127.0.0.1.
- Origin: the `mockups.html` and `studio.html` pages of edclub's games, and the model-pass skill's
  `shot-server.py` and `compare.sh`, which the plugin's skills now replace with this package.

## three-cameras

- `src/core` is the engine (`CameraLab`): cameras from the scene graph, plus the ones
  `renderer.render` is handed (it wraps `render` on the instance, and restores it on dispose unless
  something wrapped it later), live state and frame rate per camera, details, frustum helpers.
  `src/ui` is the panel in three-meter's dev-panel frame; `src/react` is `<CameraPanel />`.
- A `CubeCamera` is one entry; its face cameras, when rendered, belong to it and aren't listed.
- Its demo is `apps/site/src/demos/three-cameras`: an orbit view (the renderer's camera, outside the
  scene) and a dolly camera drawing a picture-in-picture inset, so two cameras are live at once.
- `src/core/pose.ts` is a camera's pose (capture, apply, blend); `src/core/track.ts` samples a
  track of keyframed poses (Catmull-Rom path, slerp, eased lens). The lab plays the timeline in its
  `render` hook, right before each frame, and holds tracked cameras once played or scrubbed until
  an edit or `stop()`. `src/ui/timeline.ts` is the timeline, which takes the camera list (`src/ui/panel.ts`) as its
  left column and lines each lane up with its camera's row; `mountCameraPanel` puts them in one
  frame anchored across the bottom.
- Eases are presets or custom cubic Béziers (`cubicBezier` in track.ts). `src/core/channels.ts` reads
  and writes a pose as graph channels (rotation through Euler degrees, unwrapped for plotting).
  `src/ui/graph.ts` is the graph view, `src/ui/ease-editor.ts` the curve in the key inspector; the
  lab draws motion paths (`setTrail`) under the camera's parent, since poses are local. Paths are
  `auto` by default: shown while an in-scene camera moves or has keys. The lab records each camera's
  recent motion in its `render` hook (not while its own track drives it) and `bakeMotion` simplifies
  it into keys (Ramer–Douglas–Peucker). `src/ui/path-editor.ts` drags key dots in the scene: it hit
  tests against the main view's matrices (`viewTransform`, kept per frame) in the canvas's capture
  phase, and moves keys with `moveKeyTo`.

## three-devtools

- `src/mount-dev-tools.ts` is the whole switch: the flag check, then each tool through `import()`
  (`./hud.ts` for three-meter, `@zkmake/three-audit` for the helpers, the app's own loaders for the
  panels). Keep every static import there `import type`, so a normal load pulls in nothing else;
  `dist/index.js` should stay a few hundred bytes plus the shared chunk.
- three-meter and three-audit are regular dependencies with explicit ranges (as three-cameras on
  three-meter). The panels are not: the app passes `() => import("@zkmake/three-cameras/ui")`, typed
  by shape, so a game that shows no panel never installs one. three-quality is read by shape too.
  `tests/types.ts` pins those shapes against the real modules (workspace dev deps).
- `src/react` is `<DevTools />`, one component inside the `<Canvas>`: the HUD and panels are DOM it
  mounts imperatively, and `useFrame` marks the meter's frames, as three-meter's `PerfSampler` does.
- Origin: the `debug-tools.tsx` + `perf-meter.tsx` pair in edclub's games. The `kit-adopt` skill
  swaps those copies for it.

## The agent skills (Claude Code plugin)

`plugins/three-kit/` is a Claude Code plugin: `.claude-plugin/plugin.json` and one folder per skill
under `skills/` (`SKILL.md` plus `references/`). `.claude-plugin/marketplace.json` at the root lists
it, so `/plugin marketplace add zkmake/three-kit` then `/plugin install three-kit@three-kit` installs it
from `main`. Check both with `claude plugin validate .` and `claude plugin validate plugins/three-kit`.
The same folders install in any other agent through skills.sh: `npx skills add zkmake/three-kit`
finds every `SKILL.md` (`--list` shows them). The site links it from the landing page's footer, ⌘K
(`src/pages/search.json.ts`) and the `llms.txt` header.

- **Skill text stays agent-neutral.** Write for any agent that reads skills: the thing the user
  named when invoking the skill, not `$ARGUMENTS`; "in a subagent, if your agent has them"; "a
  browser your agent can script"; "a hosted page". Claude-only frontmatter (`argument-hint`,
  `disable-model-invocation`) may stay, since other agents ignore it, so each `description` also
  says when to use the skill ("Use when the user asks for …").

- **A skill never carries kit code.** It names the packages' calls (`saveShot`, `zfight()`,
  `chunkInstances`) and has the project install them; it ships no copy of a helper, a script or a
  receiver. When a skill needs something the packages lack, add it to a package and release it.
- A skill names APIs; the package README is the authority on them. A change that renames or
  removes a call a skill names updates the skill in the same commit (`rg <call> plugins`).
- Skills stay generic: no app, studio or deploy target of any one project. A project's look and
  budgets live in its own `3D-STYLE.md` and budgets file, which the skills create and read.
- Bump `version` in `plugin.json` when the skills change, so installs pick the change up.

Origin: the `model-pass` and `scene-mockups` skills that built edclub's games' studios, and
`perf-pass` from one game's frame taken from 1.35M to under 250k triangles; the
packages' studio helpers, far copies, culling cells, shot receiver and compare script were all
extracted from them.

## Adding a package

First decide whether it should be a package at all. Packages are split by role and by what they
depend on, not by feature. A dev tool is installed with `-D` and loaded behind `?debug`; a runtime
helper (three-batch, three-quality) ships to players. A new package is worth its first-publish and
trusted-publisher setup only when its role or dependencies differ from every existing one. A
command-line tool with heavy dependencies of its own qualifies; a new dev panel does not, since it
belongs in three-devtools (an entry or an opt-in panel); a new check belongs in three-audit.

1. Create `packages/<name>/` with a `package.json` named `@zkmake/<name>`: `publishConfig.access`
   `public`, `repository.directory` set to `packages/<name>`, and `build`, `ci:typecheck`, `ci:test`
   and `pack:check` scripts. Its `tsconfig.json` extends `../../configs/typescript/tsconfig-lib.json`.
   Copy three-meter's `tsdown.config.ts` as a start.
2. Add a changeset for its first version.
3. Publish the first version by hand from your machine (`npm publish --access public` inside the
   package), since npm needs the package to exist before it can trust a workflow. Then on npmjs.com add
   a trusted publisher for it: repository `zkmake/three-kit`, workflow `release.yml`.
4. Add it to the table in the root README, and to the site: an entry in `apps/site/src/libraries.ts`,
   a mark at `apps/site/public/<name>/favicon.svg`, a share card in `scripts/make-og.ts`, a page in
   `src/pages/<name>/`, and its landing card's picture (`bun run previews` for a demo, otherwise a
   drawing in `src/components/CardMedia.astro`). Add its README to `READMES` in
   `apps/site/src/llms.ts` and check the kit summary there still holds.

## Releasing

Every user-facing change carries a changeset, made with `bun run changeset`, naming the packages it
touches. The release workflow opens one "Version Packages" PR covering every package with pending
changesets; each keeps its own version and changelog. Merging it builds the packages and publishes
the changed ones with provenance through npm trusted publishing, tagging each release
`@zkmake/<name>@<version>`. Commit messages follow Conventional Commits.

Merge the Version Packages PR when a round of work is done, not after every change: it batches
whatever is pending, so fewer, fuller releases are easier on the apps that consume them.

Versions: until 1.0 each package keeps its own version. Several read each other's data by shape
(three-meter shows three-quality's state and three-audit's budgets file; three-devtools loads
three-meter, three-audit and the panels), so an app should bump every `@zkmake` package it uses
together, to the latest of each, rather than one at a time. At 1.0 the packages move to lockstep: a
changesets `fixed` group in `.changeset/config.json` keeps one version number for all of them.
