# @zkmake/three-audit

Checks for a three.js scene: what it costs and what's wrong with it. Triangle counts, the meshes and
geometries behind them, z-fighting, NaN geometry, black frames, and a ledger of every draw call in
one frame. One budgets file per app that tests, the CLI and three-meter's HUD all read, and Vitest
matchers to hold a scene to it. Zero dependencies. The geometry checks need no renderer, so they
run in a unit test as well as the browser console.

```sh
bun add -d @zkmake/three-audit   # or npm i -D / pnpm add -D
```

## In a test

Build the object the way the app does and assert it's clean:

```ts
import { findBadGeometry, findZFighting } from "@zkmake/three-audit";
import { expect, test } from "vitest";

import { buildWindmill } from "../src/windmill.ts";

test("windmill has no z-fighting and no NaN geometry", () => {
  const windmill = buildWindmill();

  expect(findZFighting(windmill)).toEqual([]);
  expect(findBadGeometry(windmill)).toEqual([]);
});
```

A failure lists each pair of meshes with faces in one plane, facing the same way, overlapping: the
meshes by their named ancestors, the plane they share, and where they overlap.

```ts
[
  {
    a: "windmill/plinth [stone] @ (0, 0.1, 0)",
    b: "windmill/wall [plaster] @ (0, 0.5, 0)",
    triangles: 4,
    planes: ["y = 0.000, facing -y"],
    overlap: { area: 1, centre: [0, 0, 0] },
    count: 1,
  },
];
```

### Matchers

`@zkmake/three-audit/vitest` adds the checks to Vitest's `expect`. Import it once, in a test file
or a `setupFiles` module:

```ts
import "@zkmake/three-audit/vitest";

import { expect, test } from "vitest";

import budgets from "../src/budgets.ts";
import { buildKart } from "../src/kart.ts";

test("the kart", () => {
  const kart = buildKart();

  expect(kart).toFitBudget(budgets.parts.kart);
  expect(kart).toHaveNoZFighting();
  expect(kart).toHaveCleanGeometry();
});
```

| Matcher                         | Passes when                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `toFitBudget(budget, options?)` | Its triangles, draws and meshes are within the budget's (a part, or `frame`) |
| `toHaveNoZFighting(options?)`   | `findZFighting(object, options)` finds nothing                               |
| `toHaveCleanGeometry(options?)` | No NaN geometry (`findBadGeometry`) and no empty meshes (`findEmptyMeshes`)  |

A failure says what to fix, as the CLI does:

```
"kart" is over its budget on triangles:
      triangles 8,120 > 7,500  ✗
      draws        11 ≤ 12
  most triangles:
          4,000  kart/body
          2,208  kart/driver/helmet
```

`toFitBudget` takes `{ skip, top }` (meshes listed, default 5). A frame budget's `calls` counts as
`draws`; a budget that sets none of triangles, draws (calls) or meshes throws. The matchers work
negated (`.not`) and as asymmetric matchers (`expect.toFitBudget(…)`), and their types come with
the import. `installMatchers()` registers them again, for a setup that resets `expect`; `matchers`
is the object for `expect.extend`. The entry re-exports `triangles`. Vitest 5 or later.

## Budgets

One file says what the app may draw: the frame as a whole, and each part. Tests, the CLI and
[three-meter](../three-meter)'s HUD read it, so the numbers and the reasons behind them live in one
place.

```ts
// src/budgets.ts
import { defineBudgets } from "@zkmake/three-audit/budgets";

export default defineBudgets({
  frame: { fps: 60, calls: 150, triangles: 250_000 },
  parts: {
    kart: { triangles: 7_500, draws: 12 },
    fruit: { triangles: 600, meshes: 1 },
  },
});
```

| Key                 | Limit                                                               |
| ------------------- | ------------------------------------------------------------------- |
| `frame.fps`         | The frame rate to hold: three-meter's `targetFps`                   |
| `frame.calls`       | Draw calls a frame makes                                            |
| `frame.triangles`   | Triangles a frame draws                                             |
| `frame.textureMB`   | Texture memory, in MB. Kept for a perf bench; nothing checks it yet |
| `parts.*.triangles` | Triangles the part draws (`countTriangles`)                         |
| `parts.*.draws`     | Draw calls one main pass makes for it (`countDraws`)                |
| `parts.*.meshes`    | Visible meshes in it                                                |

`@zkmake/three-audit/budgets` holds `defineBudgets` and `parseBudgets` (and their types) alone,
with no imports, so the app's own code can import the file (its HUD reads it) and ship a few hundred
bytes, not the checks; the main entry exports both too. `frame` is required, `parts` optional.
`defineBudgets` returns them frozen, with each part in the type: `budgets.parts.truck` is an error
when no truck is listed. `parseBudgets(value)` checks budgets from anywhere else (JSON) and throws
on a bad key. `checkBudget(object, budget, { skip }?)`, in the main entry, measures an object
against one, a row per limit: `{ metric, actual, limit, over }`.

- In a test: `expect(kart).toFitBudget(budgets.parts.kart)`.
- In the HUD: `mountPerfHud(monitor, { budgets })` (or `<PerfHud budgets={budgets} />`) applies the
  `frame`.
- From the command line: `three-audit kart.glb --budgets budgets.json`.

## From the command line

Check exported models without writing any code:

```sh
npx @zkmake/three-audit assets/*.glb   # or bunx
```

```
windmill.glb  4,812 triangles, 14 draws
  ✗ 1 z-fighting pair
      windmill/plinth [stone] @ (0, 0.1, 0)
    ↔ windmill/wall [plaster] @ (0, 0.5, 0)
      4 triangles in y = 0.000, facing -y; overlap 1 m² at (0, 0, 0)
  ✓ no NaN geometry
  most triangles:
          1,920  sails
            …
```

It exits 1 when any model fails a check (2 when one can't be read), so it can gate CI. Empty meshes
are listed (`!`) but don't fail. Options: `--gap <m>`, `--self`, `--skip <regex>` (leave out
objects by name, e.g. decals), `--top <n>` (default 5, 0 for none), `--json` (an array of
`{ file, report, budget }`, `report` being `auditScene`'s), `--no-fail`,
`-h` / `--help`, `-v` / `--version`.

`--budgets <file>` also holds each model to the app's [budgets](#budgets): a JSON file, or a module
whose default export is them (`.js`, or `.ts` where Node strips types). A model answers to the part
named like its file (`kart.glb` to `parts.kart`), or to `--part <name>`, and to the frame's
`triangles` and `calls` for whatever its part leaves unset.

```
kart.glb  8,120 triangles, 11 draws
  ✓ no z-fighting
  ✓ no NaN geometry
  ✗ over budget "kart"
      triangles 8,120 > 7,500  ✗
      draws        11 ≤ 12
```

`.glb` and `.gltf` (buffers beside it) both load. Textures are stripped first: no check reads them.
Draco models need `draco3dgltf` installed and Meshopt models `meshoptimizer`
(`npx -p @zkmake/three-audit -p draco3dgltf three-audit model.glb`).

In a test, load a model the same way:

```ts
import { findZFighting } from "@zkmake/three-audit";
import { loadModel } from "@zkmake/three-audit/node";
import { expect, test } from "vitest";

test("windmill.glb has no z-fighting", async () => {
  expect(findZFighting(await loadModel("assets/windmill.glb"))).toEqual([]);
});
```

`parseModel(bytes, directory?)` does the same from bytes already read (GLB or glTF JSON, its
buffers resolved from `directory`). `createNodeDracoLoader()` is the in-process Draco decoder it
uses, for your own `GLTFLoader` in Node: it has the two methods `GLTFLoader` calls on a
`DRACOLoader`, so pass it with a cast (`loader.setDRACOLoader(draco as never)`).

glTF is in metres, which is what `--gap`'s default assumes. Instanced meshes
(`EXT_mesh_gpu_instancing`) aren't checked for z-fighting; skinned and morphing meshes are
checked in their rest pose.

## In the console

```ts
import { installAuditHelpers } from "@zkmake/three-audit";

installAuditHelpers(scene, { renderer }); // returns a function that removes them
```

React Three Fiber:

```tsx
const { scene, gl } = useThree();

useLayoutEffect(() => installAuditHelpers(scene, { renderer: gl }), [scene, gl]);
```

| Global                        | Returns                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `summary(tag?, options?)`     | One count per check: the call to run after every edit. `{ zFighting: false }` skips the slow one |
| `tris()`                      | Triangles one pass draws: visible meshes, instances and batches counted, no culling              |
| `meshes()`                    | Every visible mesh: triangles, instances, total, most first                                      |
| `census({ budget?, label? })` | Geometries by triangles drawn, batches broken down, hidden meshes included                       |
| `audit()`                     | Meshes with NaN positions or normals, or zero-length normals                                     |
| `zfight(gap?, self?)`         | Pairs of meshes that z-fight                                                                     |
| `report(tag?)`                | Every check in one JSON-safe object                                                              |
| `bbox(target)`                | An object's world envelope: min, max, size, centre                                               |
| `clearance(a, b)`             | The gap between two objects, and which of their meshes come closest                              |
| `ledger(options?)`            | One frame's draw calls by object and pass, and each pass's size (WebGL)                          |
| `beginLedger()`               | `{ end() }`: draw calls between the two, for any span you choose (WebGL)                         |
| `blackFrames(10)`             | `{ frames, blackFrames }`: frames in the next 10 s that came out black (WebGL)                   |
| `auditRoot`                   | The root the helpers were installed on                                                           |

A `tag` is a `userData.studioObject` value (or your `tagKey`); a tag nothing carries throws. A
`target` (`bbox`, `clearance`) is a tag too, falling back to an object's name, or the object itself.

```js
threeAudit.summary("bridge");
// { triangles: 4812, draws: 14, meshes: 9, zFighting: 0, selfZFighting: 0, badGeometry: 0, emptyMeshes: 0 }
threeAudit.clearance("train", "tower");
// { gap: 0.15, axis: "y", between: ["train/car [paint]", "tower/crossbar [steel]"] }
```

Each one is also on `threeAudit` (`threeAudit.report()`). Where short names like `report` collide
with other tooling, `installAuditHelpers(scene, { globals: false })` installs only `threeAudit`.
The other options: `renderer` (the WebGL renderer `ledger`, `beginLedger` and `blackFrames` need;
without it they throw), `skip`, `tagKey`, [`bakes`](#baked-groups), and `batchLabel`, which names
the geometries inside a batch in `census()` (`geometryCensus`'s `label`).
[three-devtools](../three-devtools) installs them behind `?debug` (its `audit` option), and
[three-studio](../three-studio)'s pages install them on their own scene.

From a headless browser: `agent-browser eval 'JSON.stringify(threeAudit.report())'`.

A tab an agent drives is often in the background, where the browser pauses animation frames.
`ledger()` and `blackFrames()` fail after 2 s with an error that says so, instead of waiting for
ever. To record a background tab's draws, have the ledger record one call of your app's own
render: `ledger({ render: () => app.renderOnce() })`. Black frames need a visible tab.

## The checks

### `findZFighting(root, options?)`

Triangles are bucketed by plane (normal and offset), then tested for overlap in their shared plane.
World space, so parent transforms count.

- `gap` (default `0.004`): how close two planes count as one, in world units. 4 mm at 1 unit = 1 m is
  about what depth precision loses with a camera ~50 m out. Scale it with your units.
- `self`: also compare triangles within one mesh, for merged geometry.
- `tagged`: only meshes inside an object with `userData.studioObject` (or `tagKey`). Defaults to on
  when anything under the root is tagged, so a studio's ground and props stay out.
- `skip(object)`: leave an object and its subtree out, e.g. a merged copy whose sources are still in
  the scene: `skip: (o) => o.userData.bakedResult === true`.

Each row names both meshes by their named ancestors (`bridge/deck/slab [concrete]`), the planes they
share (`z = -3.000, facing -z`; opposite-facing faces never pair), and the overlap's area in world
units² and its centre. Identical pairs, such as pooled copies of one prop parked at one spot, fold
into one row with a `count`.

Left out because they can't fight:

- hidden objects, except a bake's parts (see "Baked groups" below)
- instanced and batched meshes, and `InstancedBufferGeometry`, which a shader positions. Check
  their source parts as plain meshes.
- pairs where neither material writes depth, or one ignores depth entirely. A decal that doesn't
  write depth, over a wall that does, still fights and is still listed.
- pairs where either material has a polygon offset, the usual decal fix

Typical fixes: stand the smaller part 5 mm off, shorten it inside the larger one, or fit panels
between each other instead of over each other's ends.

### `findBadGeometry(root, options?)`

Vertices with a non-finite position or normal, and zero-length normals on triangles with area.
Either lights a pixel NaN, and bloom smears one NaN pixel into a black block. Hidden meshes are
checked too. A row is `{ mesh, under, nonFinite, zeroNormals }`, `under` being the tagged part it
sits in (or its parent's name). Options: `skip`, `tagKey`, `bakes`.

### `summarizeScene(root, options?)`

Every check as one count: `{ triangles, draws, meshes, zFighting, selfZFighting, badGeometry,
emptyMeshes }`. `tag` narrows it to one tagged object. `zFighting: false` skips the slowest check
(its counts come back `null`) for a quick look at a large scene.

### `countTriangles`, `listMeshes`, `geometryCensus`, `countDraws`, `triangles`

Where a triangle budget goes. `countTriangles` counts what one pass draws, with no culling; a shadow
pass adds roughly as much again per shadow-casting light. `triangles(target)` is the one a test
reaches for: a geometry's own triangles (`triangleCount`, within its draw range), or what an object
draws (`countTriangles`). Name meshes and geometries (`mesh.name`, `geometry.name`) so the rows say
something. A mesh row's `name` is its named ancestors, then its own name, or its geometry's name or
type when it has none (`CharacterHands/left/BoxGeometry`).

`geometryCensus` lists a `BatchedMesh` one geometry at a time: visible instances × triangles each,
which is where a batch's budget actually goes. Rows are `batch#id` unless `label(batch, geometryId)`
names them from the app's own records. Each row has its `share` of the total; with `budget: 0.2`,
rows over 20% get `overBudget: true`.

```
geometry            uses  triangles    total  share  overBudget
treadmill_belt       570        513  292,410  0.306  true
treadmill_coupler    570        297  169,290  0.177  false
```

`countDraws` counts the draw calls one main pass makes: one per visible mesh, line, point cloud or
sprite, one per material group when a mesh has several. It doesn't cull and doesn't count shadows;
the draw ledger counts the real thing.

### `findEmptyMeshes(root, options?)`

Meshes with no vertices, such as what merging nothing leaves. Each one still costs a draw call and
a geometry to dispose. A zero draw range doesn't count, since that's usually a pool waiting to fill.
Hidden meshes are included; it takes `findBadGeometry`'s options.

### `measureBounds(root, target, options?)` / `measureClearance(root, a, b, options?)`

An object's world envelope, and the smallest gap between two objects, from their vertices as drawn:
instances and batches included, rotations exact. The gap is measured between triangles' bounding
boxes, which is exact for faces square to the axes and slightly under for sloped ones. So a tower
merged into one mesh still measures to its crossbar, not to the box around the whole tower. `axis`
says which way the gap runs when it's straight along one axis (`null` when diagonal). Draw ranges
are respected. A target matching nothing throws; one that draws nothing gives `null`. Options:
`tagKey`, `bakes`.

### `recordDrawLedger(renderer)` / `beginDrawLedger(renderer)`

Wraps `WebGLRenderer.renderBufferDirect` and counts every draw by object name, by group (the name up
to its first `:` or `#`, or your `groupOf(name)`), and by pass: `shadow`, then each `render()` call
by scene name, or `render 1`, `render 2`… An unnamed object goes by its named ancestors, type and
material (`CharacterHands/Mesh [skin]`).

Each row (object or group) carries its draws per pass (`passes`) and its triangles, in all
(`triangles`) and per pass (`passTriangles`): what a frame really draws of each part, so the city
and the shadow pass each have a number. A `BatchedMesh` counts only the instances three drew that
pass, after culling them one by one.

`recordDrawLedger` records exactly one animation frame, and fails after `timeout` (2 s) when no
frame comes. `{ render }` records one call of your own render instead, frames or not.
`beginDrawLedger` returns `{ end() }` for any span. `printDrawLedger` prints the tables;
`ledgerTable(rows, passes)` is one of them as rows for `console.table`.

`passStats` sizes each pass: draws, distinct objects (for `shadow`, the casters), triangles, and
the targets drawn to in device pixels (`screen 2880×1800` for the canvas). A pass is `fullscreen`
when each call drew one small mesh through an orthographic camera, the shape of a post-processing
pass. `fullscreenPasses` and `fullscreenPixels` total them: 8 fullscreen passes at 2880×1800 shade
41 Mpx a frame before the scene itself draws a pixel.

### `watchBlackFrames(renderer)`

After each render to the screen, reads a 3 × 3 grid of pixels and counts frames where three or more
are pure black (options `grid` and `threshold` set the two numbers). Use a visible browser:
headless ones haven't reproduced black frames. Each read stalls the GPU, so watch, read `frames`
and `blackFrames` (which frames, 1-based), `stop()`; `reset()` starts the count over.

### `auditScene(root, options?)`

`{ triangles, draws, zFighting, badGeometry, emptyMeshes, meshes }` in one call, `meshes` the
costliest `top` (default 10). `tag` narrows it to one tagged object. Rows carry the live mesh as a
non-enumerable property (`row.mesh` on a mesh row, `row.meshes` and `row.pairs` on a z-fighting
row, `row.object` on a bad or empty one), so they print and serialise without dragging the scene
along.

## Baked groups

[`@zkmake/three-batch`](../three-batch)'s `bake` and `<Baked>` hide the parts and draw one merged
mesh per material. For z-fighting, NaN geometry, empty meshes, `bbox` and `clearance`,
three-audit checks the parts instead of the merge by default (`bakes: "sources"`). A row then
names the deck and the rail rather than `bridge:steel`, and a part is never compared with its own
merged copy. Parts are found by three-batch's `userData.bakeSource` flag. For bakes from before
that flag, they're the hidden objects inside anything holding a `userData.bakedResult` merge.
`bakes: "merged"` checks what's drawn instead.

Costs (`tris`, `meshes`, `census`, draws) always count what's drawn: the merge.

## Types

The checks take any object with three's `isObject3D` flag, and the renderer as only the methods
they call. An app on a newer `@types/three` than the one this package was built against passes its
scene and renderer without a cast.

## License

MIT
