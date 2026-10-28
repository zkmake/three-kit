# Survey: one frame at each play position

How to measure what the frame draws, in the running app, and break the top area down. Loaded by steps 1–3.

## Driving the app

- A browser you can script, one session at a time: a browser pane your agent drives while it is shown, or a headless one (`agent-browser`, Playwright). A hidden pane or background tab gets no animation frames: a renderer-driven loader may never finish, and nothing draws. When the pane is hidden, go headless.
- One fixed viewport for the whole loop (1200 × 800): what is culled depends on the aspect, so numbers from two sizes don't compare. Note the device pixel ratio with the table.
- Reach each play position the same way every time (a URL parameter, a console call, a scripted input), then wait until the app reports loaded and `ledger()` is installed before recording.
- Mute the app's audio once loaded (its own mute setting, `media.muted`).

## One frame

`ledger()` in the console records one animation frame (in a background tab: `ledger({ render: () => app.renderOnce() })` with the app's own render). From its result:

- `passStats`: each pass (`shadow`, then each `render()` by scene name): draws, distinct objects (the shadow casters), triangles, the targets drawn to. The frame's triangles are the sum over every pass.
- `groups` and `objects`: each row's draws per pass (`passes`) and triangles (`triangles`, `passTriangles`). A row is an area's cost in this frame, shadow pass included. A `BatchedMesh` row counts only the instances three kept after culling them one by one (three-audit 0.5 and later; 0.4.0 counts every visible instance and has no row triangles, so read the batch's `_multiDrawCounts` instead).
- `fullscreenPasses`, `fullscreenPixels`: post-processing's cost, in pixels shaded before the scene draws one.

Beside it, the world's worth, for counts and names: `summary()` (one count per check), `census()` (geometries by triangles drawn, batches broken down by geometry, hidden meshes included), `meshes()`. Rows named `BufferGeometry:…` or `Mesh [Material]` are unnamed: name them before ranking, or the ledger can't say what costs what.

Loading and memory, where the browser gives them, once per play position that loads more:

- `renderer.info.memory` (geometries, textures) and three-meter's HUD (GPU memory, CPU and GPU time) for what the GPU holds.
- `performance.memory.usedJSHeapSize` (Chromium) for the heap. A dev build's heap is several times production's: measure heap and load time on the production build (`vite preview`), triangles and draws on either.
- `performance.getEntriesByType("resource")`: requests and `transferSize` for what loading costs.

## Baseline table

```md
| Play position | Frame triangles (shadow + main) | Draws | Top areas (triangles, main / shadow) | vs `frame` |
| ------------- | ------------------------------- | ----- | ------------------------------------ | ---------- |
| start         | 207,138 (31,119 + 176,019)      | 49    | city 84,269 / 0, forest 25,324 / 0   | 83%        |
```

Keep it in the pass folder and the style guide's _Pass log_; every later survey is read against it.

## Breaking an area down

The ledger names the area; the cause is inside it:

- **Instanced or batched**: count what's drawn by geometry and by distance from the camera. For a `BatchedMesh`, walk its instances (`getMatrixAt`, `getBoundingSphereAt`), keep those inside the camera's frustum, and sum triangles per geometry and distance band (the app's own detail-level distances). `census()` gives the per-geometry counts for the world.
- **A row that never changes** across play positions, or the same at the edge of the view as at the centre: nothing culls it (one bounds over the world, culling off).
- **The shadow pass**: `passStats`' shadow `objects` are the casters; compare them with what the shadow camera's box can reach.
- **Test a cost by hiding it**: three-meter's top costs hide a row and show what the frame saves, before any fix is written.
- Name the cause with its numbers: copies drawn × triangles each, the distance they are seen from, the pass.
