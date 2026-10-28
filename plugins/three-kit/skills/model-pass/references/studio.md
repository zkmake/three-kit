# Studio

A dev-only page that mounts one object at the origin, lit and shaded exactly like the app, with named camera views and console helpers. Every pass measures here. It is a `@zkmake/three-studio` page: the package brings the URL state, the views, orbit controls, the readout, wireframe, frozen time, three-audit's helpers and `saveShot`; the project brings its objects, its look and its play view.

## Building it

1. **Install** `@zkmake/three-studio` and `@zkmake/three-audit` as dev dependencies, the project's way (its package manager, version pins, catalog). Add `@zkmake/three-batch` (runtime) and `meshoptimizer` when the project gets far copies or culling cells.
2. **A second entry that never ships.** Vite: `studio.html` next to `index.html`, loading `src/studio.tsx` (or `.ts`). Vite serves every HTML file in dev but builds only `index.html` unless `build.rollupOptions.input` lists more; keep the studio out of that list. Other bundlers: a dev-only route guarded by the dev flag.
3. **The config.** One **area** per object or family, each with one variant (`now`) unless the object has real variants; the area key is the URL's bare `?<object>`. Views on the config apply to every area:

   ```ts
   import { orbitViews, type StudioConfig } from "@zkmake/three-studio";

   const config: StudioConfig = {
     // play: the app camera's exact offset from what it looks at, and its lens, read from the camera code.
     views: orbitViews([0, 0.6, 0], 4.5, { play: { offset: [0, 3.4, 7.5], fov: 55 } }),
     areas: {
       windmill: { variants: { now: {} }, views: orbitViews([0, 4, 0], 14) },
       tree: { variants: { oak: {}, pine: {} } },
     },
   };
   ```

   `orbitViews(centre, near, { play })` gives `play`, `close`, `front`, `side`, `back`, `top`. A camera that aims ahead of its subject (a chase camera looking down the road) is a hand-written view, `{ position, target, fov }`, copied from the camera code. An area's own views (detail close-ups like `hinge`, `cap`) add to the config's.

4. **The page, in the app's look.** Reuse the app's renderer settings, lights, environment, fog, post-processing and shared materials by importing them, never by copying values. A plain ground plane under the object keeps contact readable.

   React Three Fiber: `<Studio config={config} canvas={…the app's Canvas props…} stage={() => <AppLights />} />`, each variant `{ render: () => <Windmill /> }`. `canvas` and `stage` also take a function of the state, for an area that needs fog or a wider ground.

   Vanilla: `resolveStudio(config, location.search)`, build the area's object, set `group.userData.studioObject = state.tag`, then `mountStudio({ state, renderer, scene, camera })` and call `studio.update()` after each render. With post-processing, pass `render: () => composer.render()` so shots include it.

5. **Animation.** Anything animated reads time through `useStudioTime()` (R3F) so `&t=<seconds>` freezes it for steady shots.

Done when the page shows the object from `play`, the readout fills, and `summary()`, `zfight()` and `audit()` answer from the console.

## Adding an object

Add an area: its variant renders the object at the origin, as the app builds it (import the app's builder or component, never a copy). Give it views when the config's don't frame it (a different centre or size). Shoot every new view and look at it: a view that misses the object, starts inside it, or looks end-on is fixed before any measuring. List the area and its views in the style guide's _Studio_ section.

- **Baked** objects (three-batch's `bake` / `<Baked>`): three-audit checks the hidden source parts by default, so fights name parts, not the merge. A merge of your own: run `zfight(0.004, true)` on it.
- **Instanced and batched** meshes are skipped by `zfight()`: mount one copy of the source geometry as a plain mesh in its own area to audit it.
- **Scatter** (a slice of the world): generate it from the app's real seeds and placement code, with a seed that contains the rare pieces.

## Far copies

`simplifyReport` needs `meshoptimizer`, so it is not a console global. Expose it from the studio page in dev:

```ts
import { simplifyReport } from "@zkmake/three-batch/lod";

Object.assign(window, {
  lodReport: (errors: number[]) => simplifyReport(window.studio!.scene, errors),
});
```

`lodReport([0.01, 0.02, 0.03])` then lists, per tagged object, triangles in full and at each error. Pin the level a switch shows with `pinLevel("far")` behind a `?lod=far` flag, so the far copy can be shot at the play view.
