# Contributing

A Bun workspace: every package in `packages/` and every demo in `examples/` is a member, and one
`bun install` at the root sets them all up. Run scripts from the root; they fan out to every package.

```sh
bun install
bun run typecheck   # tsc in every package and example
bun run test        # vitest across the repo
bun run build       # each package: tsdown to dist/, then publint and arethetypeswrong
bun run lint        # oxlint
bun run format      # oxfmt
```

To work on one package, filter: `bun run --filter @zkmake/three-meter build`.

Shared tooling lives at the root: `tsconfig.base.json` (each package's `tsconfig.json` extends it),
`oxlint.config.ts`, `oxfmt.config.ts`, `bunfig.toml`, the changesets config and the workflows.
`docs/` holds the images package READMEs load; keep existing files at their paths, since READMEs of
published versions link to them on `main`.

## three-meter

- `src/core` holds `PerformanceMonitor`, the GPU timer, the frame stats and the scene-cost walk. No
  DOM, no deps. The renderer contract is the structural `PerfRenderer` type, and
  `tests/renderer-types.ts` pins it against three's real `WebGLRenderer` and `WebGPURenderer`.
- `src/ui` holds the DOM card, the dock, the settings and the injected stylesheet. No runtime deps.
- `src/react` holds the React Three Fiber adapter. Peer deps only.

`three` is a devDependency for the type pin and must stay out of `dependencies`.

`examples/site` is its demo, the Vite app at three-meter.pages.dev with both the vanilla three and the
React Three Fiber integration (`src/demos/`). Run `bun run dev` inside it. It aliases
`@zkmake/three-meter` to the package's `src/` through Vite `resolve.alias` and tsconfig `paths`, so
editing the library hot-reloads with no build step.

## Adding a package

1. Create `packages/<name>/` with a `package.json` named `@zkmake/<name>`, `publishConfig.access`
   `public`, `repository.directory` set to `packages/<name>`, and a `tsconfig.json` extending
   `../../tsconfig.base.json`. Give it `build`, `typecheck` and `pack:check` scripts; copy three-meter's
   `tsdown.config.ts` as a start.
2. Add a changeset for its first version.
3. Publish the first version by hand from your machine (`npm publish --access public` inside the
   package), since npm needs the package to exist before it can trust a workflow. Then on npmjs.com add
   a trusted publisher for it: repository `zkmake/three-kit`, workflow `release.yml`.
4. Add it to the table in the root README.

Packages that depend on each other: changesets publishes with plain `npm publish` in a Bun workspace,
which doesn't rewrite `workspace:*` ranges. Before one package depends on another, switch the
workspace to pnpm or rewrite those ranges before publishing.

## Releasing

Every user-facing change carries a changeset, made with `bun run changeset`, naming the packages it
touches. The release workflow opens one "Version Packages" PR covering every package with pending
changesets; each keeps its own version and changelog. Merging it publishes the changed packages with
provenance through npm trusted publishing and tags each release `@zkmake/<name>@<version>`. Commit
messages follow Conventional Commits.
