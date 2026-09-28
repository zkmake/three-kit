# Contributing

A Bun workspace run by Turborepo, set up like `edtech-apps`: published packages in `packages/`, demo
apps in `apps/`, shared config in `configs/`. One `bun install` at the root sets them all up, and root
scripts run each task in every workspace, in dependency order, cached by turbo.

```sh
bun install
bun run ci-local       # everything CI runs: format, lint, typecheck, test, build, pack
bun run build          # packages (tsdown, then publint and arethetypeswrong) and apps (vite)
bun run ci:typecheck   # tsc in every workspace
bun run ci:test        # vitest in every workspace
bun run lint:fix       # oxlint
bun run format:fix     # oxfmt
bun run dev            # the demo app with hot reload
```

To run one workspace, filter: `bunx turbo run build --filter=@zkmake/three-meter`, or run its script
from its folder.

## Versions: the catalog

Shared dependency versions (three, React, r3f, their types, Vite, Vitest, tsdown, TypeScript) are
pinned once in the root `package.json` under `workspaces.catalog`. Workspaces depend on them with
`"catalog:"`, so bumping three is one line.

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

`apps/three-meter-site` is its demo, the Vite app at three-meter.pages.dev with both the vanilla three
and the React Three Fiber integration (`src/demos/`). It aliases `@zkmake/three-meter` to the
package's `src/` through Vite `resolve.alias` and tsconfig `paths`, so editing the library hot-reloads
with no build step.

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
- The model-pass skill's studio helpers are the origin; the skill should install this package
  rather than copy its assets.

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
- `apps/three-textures-demo` (port 3022) has an image, a clone, a data texture, and a KTX2 when
  `public/local/atlas.ktx2` exists (gitignored: bring your own). Its round trip (download each,
  swap it back) should leave the scene unchanged.

## Adding a package

1. Create `packages/<name>/` with a `package.json` named `@zkmake/<name>`: `publishConfig.access`
   `public`, `repository.directory` set to `packages/<name>`, and `build`, `ci:typecheck`, `ci:test`
   and `pack:check` scripts. Its `tsconfig.json` extends `../../configs/typescript/tsconfig-lib.json`.
   Copy three-meter's `tsdown.config.ts` as a start.
2. Add a changeset for its first version.
3. Publish the first version by hand from your machine (`npm publish --access public` inside the
   package), since npm needs the package to exist before it can trust a workflow. Then on npmjs.com add
   a trusted publisher for it: repository `zkmake/three-kit`, workflow `release.yml`.
4. Add it to the table in the root README.

## Releasing

Every user-facing change carries a changeset, made with `bun run changeset`, naming the packages it
touches. The release workflow opens one "Version Packages" PR covering every package with pending
changesets; each keeps its own version and changelog. Merging it builds the packages and publishes
the changed ones with provenance through npm trusted publishing, tagging each release
`@zkmake/<name>@<version>`. Commit messages follow Conventional Commits.
