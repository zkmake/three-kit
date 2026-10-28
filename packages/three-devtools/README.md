# @zkmake/three-devtools

An app's dev tools behind `?debug`, in one drop-in: the [three-meter](../three-meter) HUD with the
app's budgets file and its adaptive-quality line, [three-audit](../three-audit)'s console helpers
(`tris()`, `ledger()`, `zfight()` …) on the live scene, and the [camera](../three-cameras) and
[texture](../three-textures) panels when the app asks for them. Everything heavy loads through
`import()` only when it's on, so a normal load runs one URL check and stops: three-meter and
three-audit end up in chunks the page never fetches. Vanilla three or React Three Fiber, WebGL or
WebGPU.

```sh
bun add @zkmake/three-devtools   # or npm i / pnpm add
```

Install it as a normal dependency: the app's code imports it, and `?debug` works on the deployed
game too. It brings three-meter and three-audit; the panels are separate packages, installed only by
the apps that show them.

Entries: `@zkmake/three-devtools` (vanilla) and `@zkmake/three-devtools/react` (needs `react` and
`@react-three/fiber`).

## React Three Fiber

```tsx
import { DevTools } from "@zkmake/three-devtools/react";
import { qualityStore } from "@zkmake/three-quality/react";

import budgets from "./budgets.ts"; // defineBudgets from "@zkmake/three-audit/budgets"

<Canvas>
  <Scene />
  <DevTools budgets={budgets} quality={qualityStore} dev={import.meta.env.DEV} />
</Canvas>;
```

One component, inside the `<Canvas>`: it reads the scene and renderer from the canvas and marks a
frame for the meter from `useFrame`. The HUD and the panels are DOM it mounts itself, so there's no
second component outside the canvas.

## Vanilla three

```ts
import { mountDevTools } from "@zkmake/three-devtools";

const tools = mountDevTools({ renderer, scene, budgets, dev: import.meta.env.DEV });

renderer.setAnimationLoop(
  tools.wrap((time) => {
    update(time);
    renderer.render(scene, camera);
  }),
);
// later: tools.dispose()
```

`wrap` makes each tick one frame for the meter (or call `tools.frame()` once a frame, before it
renders). Without the flag both are pass-throughs.

## What turns on when

|                               | Normal load | `dev` | `?debug` |
| ----------------------------- | ----------- | ----- | -------- |
| three-audit's console helpers |             | ✓     | ✓        |
| three-meter HUD               |             |       | ✓        |
| Panels (`panels`)             |             |       | ✓        |

`dev` is for the build to say: pass `import.meta.env.DEV` (Vite) or your bundler's equivalent, so a
production build keeps the helpers behind the flag. `flag` renames the query parameter;
`enabled` overrides it (a settings toggle, a test). `hasDebugFlag(flag?)` is the same check, for
the app's own debug-only bits.

## Budgets and quality

`budgets` takes the app's budgets file, three-audit's `defineBudgets`, whose `frame` sets the HUD's
target frame rate, draw calls and triangles; the same file the app's tests hold parts to with
`toFitBudget`. Write it with `defineBudgets` from `@zkmake/three-audit/budgets`, which holds it alone:
from the main entry, the app's first load would carry every check and the console helpers couldn't
split off. The HUD's own budgets object (`{ calls: 60, targetFps: 60 }`) works too.

`quality` shows [three-quality](../three-quality)'s state as one line in the HUD,
`dpr 1.25 · adapting`: its `qualityStore` in React, the `adaptQuality(…)` handle in vanilla. It's
read by shape, so this package doesn't depend on three-quality. Both apply live.

## Panels

Each panel is the app's own `import()` of the panel package, so only an app that installs a panel
bundles it, and only `?debug` fetches it:

```tsx
<DevTools
  budgets={budgets}
  panels={{
    cameras: () => import("@zkmake/three-cameras/ui"),
    textures: () => import("@zkmake/three-textures/ui"),
  }}
/>
```

They mount with the canvas's scene and renderer (and `invalidate`, for `frameloop="demand"`). A
panel that fails to load warns and leaves the rest.

## Keep it out of the first load

The tools only stay lazy if the bundler gives them their own chunks. Two things undo that:

- **A catch-all vendor chunk group**: a rule that sends every `node_modules` module to one `vendor`
  chunk (Vite's `codeSplitting.groups`, `manualChunks`) puts three-meter and three-audit in a chunk
  `index.html` preloads. Leave `@zkmake` out of it:

  ```ts
  // vite.config.ts, build.rolldownOptions.output.codeSplitting.groups
  {
    name: "vendor",
    // Everything in node_modules but @zkmake, whose dev tools load behind ?debug.
    test: /^(?!.*[\\/]node_modules[\\/]@zkmake[\\/]).*[\\/]node_modules[\\/]/,
    priority: 10,
  },
  ```

- **The budgets file from three-audit's main entry**: the app's code imports it, so import
  `defineBudgets` from `@zkmake/three-audit/budgets`, as above.

Check a production build: no chunk that `index.html` loads or preloads contains three-meter's
`PerformanceMonitor` or three-audit's `findZFighting` (not a storage key like `perf-hud`, which the
app's own code holds), and a load without the flag fetches neither.

## Options

`mountDevTools(options)` and `<DevTools>` (all but `renderer`, `scene` and `invalidate`, which it
reads from the canvas) take:

| Option       | Default   | Meaning                                                                                              |
| ------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| `renderer`   | required  | The app's renderer.                                                                                  |
| `scene`      | required  | The app's scene: the helpers and panels read it.                                                     |
| `flag`       | `"debug"` | The query parameter that turns the tools on.                                                         |
| `enabled`    | the flag  | On or off whatever the URL says.                                                                     |
| `dev`        | `false`   | The console helpers without the flag.                                                                |
| `budgets`    |           | The app's budgets file, or the HUD's own budgets; `false` for none.                                  |
| `quality`    |           | three-quality's `qualityStore` or `adaptQuality` handle.                                             |
| `theme`      | `system`  | `dark`, `light` or `system`, for the HUD and the panels.                                             |
| `hud`        |           | three-meter's `mountPerfHud` options (`defaultPlacement`, `storageKey`, `mode`); `false` for no HUD. |
| `audit`      |           | three-audit's `installAuditHelpers` options (`skip`, `bakes`, `globals`); `false` for none.          |
| `panels`     | none      | `{ cameras, textures }`: loaders, as above.                                                          |
| `invalidate` |           | Ask for a frame, for render-on-demand loops.                                                         |

The handle: `enabled`, `ready` (settles once everything that's on has mounted), `monitor` and `hud`
once loaded, `frame()`, `wrap(loop)`, `setBudgets`, `setQuality`, `dispose()`.

In React, `budgets` (by value) and `quality` apply live; `flag`, `enabled`, `dev`, `hud` and which
`panels` are set remount the tools; the rest is read on mount.

Origin: the `debug-tools.tsx` and `perf-meter.tsx` pair copied into edclub's games, one per game,
each with its budgets written into the file.
