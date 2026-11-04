# @zkmake/three-audit

Checks for a three.js scene: what it costs and what's wrong with it. Triangle counts, the meshes and
geometries behind them, texture memory and overdraw, a ledger of every draw call in one frame.
Z-fighting, parts poking through each other, floating or sunk parts, NaN geometry, shadow and colour
setups that draw wrong, unnamed meshes, black frames. One budgets file per app that tests, the CLI
and three-meter's HUD all read, and Vitest matchers to hold a scene to it. Zero dependencies. The
geometry checks need no renderer, so they run in a unit test as well as the browser console.

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
  expect(kart).toHaveNamedMeshes();
});

test("the city", () => {
  const city = buildCity();

  expect(city).toHaveNoIntersections({ between: ["trees", "wires"] });
  expect(city).toHaveNothingFloating({ skip: (object) => object.name === "birds" });
});
```

| Matcher                           | Passes when                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `toFitBudget(budget, options?)`   | Its triangles, draws, meshes and texture memory are within the budget's (a part, or `frame`) |
| `toHaveNoZFighting(options?)`     | `findZFighting(object, options)` finds nothing                                               |
| `toHaveCleanGeometry(options?)`   | No NaN geometry (`findBadGeometry`) and no empty meshes (`findEmptyMeshes`)                  |
| `toHaveNoIntersections(options?)` | `findIntersections(object, options)` finds nothing                                           |
| `toHaveNothingFloating(options?)` | `findFloating(object, options)` finds nothing                                                |
| `toHaveNothingSunk(options?)`     | `findSunk(object, options)` finds nothing                                                    |
| `toHaveNamedMeshes(options?)`     | `findUnnamedMeshes(object, options)` finds nothing                                           |
| `toHaveSoundShadows(options?)`    | `findShadowIssues(object, options)` finds nothing                                            |
| `toHaveSoundColors(options?)`     | `findColorIssues(object, options)` finds nothing                                             |

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
`draws`; a budget that sets none of triangles, draws (calls), meshes or textureMB throws. The matchers work
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

| Key                 | Limit                                                |
| ------------------- | ---------------------------------------------------- |
| `frame.fps`         | The frame rate to hold: three-meter's `targetFps`    |
| `frame.calls`       | Draw calls a frame makes                             |
| `frame.triangles`   | Triangles a frame draws                              |
| `frame.textureMB`   | Texture memory on the GPU, in MB (`textureMemory`)   |
| `parts.*.triangles` | Triangles the part draws (`countTriangles`)          |
| `parts.*.draws`     | Draw calls one main pass makes for it (`countDraws`) |
| `parts.*.meshes`    | Visible meshes in it                                 |

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

It exits 1 when any model fails a check (2 when one can't be read), so it can gate CI. Empty meshes,
unnamed meshes and transparent draws are listed (`!`) but don't fail, and neither does texture
memory unless a budget caps it. Options: `--gap <m>`, `--self`, `--skip <regex>` (leave out
objects by name, e.g. decals), `--top <n>` (default 5, 0 for none), `--json` (an array of
`{ file, report, budget }`, `report` being `auditScene`'s), `--no-fail`,
`-h` / `--help`, `-v` / `--version`.

Two checks only run when asked, as a model often fails them on purpose: `--intersections` for
parts crossing each other, and `--ground <y>` for parts floating over, or sunk under, the ground at
that height. A kit of models all stored at the origin crosses itself throughout, so these are for
one model at a time.

`--budgets <file>` also holds each model to the app's [budgets](#budgets): a JSON file, or a module
whose default export is them (`.js`, or `.ts` where Node strips types). A model answers to the part
named like its file (`kart.glb` to `parts.kart`), or to `--part <name>`, and to the frame's
`triangles`, `calls` and `textureMB` for whatever its part leaves unset.

```
kart.glb  8,120 triangles, 11 draws
  ✓ no z-fighting
  ✓ no NaN geometry
  ✗ over budget "kart"
      triangles 8,120 > 7,500  ✗
      draws        11 ≤ 12
```

`.glb` and `.gltf` (buffers beside it) both load. Textures are stripped first, as decoding them
needs a DOM; each image's size is read from its header (PNG, JPEG, WebP, KTX2) for the texture
memory line, at 4 bytes a pixel, or about 1 for KTX2. Draco models need `draco3dgltf` installed and
Meshopt models `meshoptimizer`, fallback buffers included
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
| `intersect(a?, b?, options?)` | Pairs of meshes whose surfaces cross, all of them or only between two targets                    |
| `floating(ground?, options?)` | Groups of touching parts that nothing joins to the ground (default y = 0)                        |
| `sunk(ground?, options?)`     | Parts further under the ground than they should be                                               |
| `unnamed()`                   | Meshes every other row can only call by their type, most triangles first                         |
| `shadows(camera?)`            | Shadow setups that draw wrong                                                                    |
| `colors()`                    | Colour spaces and output settings that draw wrong                                                |
| `texmem()`                    | What the textures cost on the GPU, most first                                                    |
| `overdraw(camera?)`           | Transparent and additive draws, and with a camera how many screens they cover                    |
| `report(tag?)`                | Every check in one JSON-safe object                                                              |
| `bbox(target)`                | An object's world envelope: min, max, size, centre                                               |
| `clearance(a, b)`             | The gap between two objects, and which of their meshes come closest                              |
| `ledger(options?)`            | One frame's draw calls by object and pass, and each pass's size                                  |
| `beginLedger()`               | `{ end() }`: draw calls between the two, for any span you choose                                 |
| `blackFrames(10)`             | `{ frames, blackFrames }`: frames in the next 10 s that came out black (WebGL)                   |
| `auditRoot`                   | The root the helpers were installed on                                                           |

A `tag` is a `userData.studioObject` value (or your `tagKey`); a tag nothing carries throws. A
`target` (`bbox`, `clearance`) is a tag too, falling back to an object's name, or the object itself.

```js
threeAudit.summary("bridge");
// { triangles: 4812, draws: 14, meshes: 9, zFighting: 0, selfZFighting: 0, badGeometry: 0, emptyMeshes: 0,
//   unnamed: 0, shadowIssues: 0, colorIssues: 0 }
threeAudit.clearance("train", "tower");
// { gap: 0.15, axis: "y", between: ["train/car [paint]", "tower/crossbar [steel]"] }
```

Each one is also on `threeAudit` (`threeAudit.report()`). Where short names like `report` collide
with other tooling, `installAuditHelpers(scene, { globals: false })` installs only `threeAudit`.
The other options: `renderer` (what `ledger` and `beginLedger` need, on WebGL or WebGPU, and
`blackFrames`, on WebGL only; without it they throw; `shadows`, `colors`, `summary` and `report`
read its settings), `camera` (the player's, or a function that returns the current one, for
`shadows` and `overdraw`), `skip`, `tagKey`, [`bakes`](#baked-groups), and `batchLabel`, which names
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

Left out, because they can't fight or their stored positions can't say:

- hidden objects, except a bake's parts (see "Baked groups" below)
- instanced and batched meshes, `InstancedBufferGeometry`, a 2D `position`, and node materials with a
  `positionNode` or `vertexNode`: a shader positions those, so what's stored isn't where they draw,
  and a real fight on one goes unreported. Check their source parts as plain meshes.
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

### `findIntersections(root, options?)`

Parts poking through each other: pairs of meshes whose triangles cross, instances and batch members
each as a piece of its own. A crossing counts when each triangle passes through the other's plane by
more than `depth`, so a box resting on a floor doesn't count, and neither do faces in one plane,
which are z-fighting's. One part wholly inside another has no crossing to find.

```ts
[
  {
    a: "city/trees [leaves]",
    b: "city/buildings [brick]",
    crossings: 40,
    length: 208.3, // of the lines where the surfaces cross
    depth: 3.03, // how far the deepest one passes through
    at: [-69.59, 14.65, -214],
    count: 20, // pairs of pieces folded in: copies of the same two meshes
  },
];
```

Parts join on purpose (a handle into a door, a hat onto a head), so nothing here says which
crossings are wrong, and it's in neither `summary()` nor the CLI's default run. Ask about what should
stay apart, or leave out what's meant:

- `between: [a, b]`: only crossings with one side in each, each a tag or name as `bbox` takes them.
  The way to ask whether tree crowns reach the wires.
- `allow(a, b)`: return true to leave a pair of meshes out.
- `depth` (default `0.004`): raise it to ignore parts seated a little into each other. Scale it with
  your units.
- `instances`: also compare the copies of one instanced or batched mesh with each other.
- `tagged`, `tagKey`, `skip`, `bakes`, as `findZFighting`.

Left out: hidden objects, and what a shader positions.

### `findFloating(root, options?)`

Groups of touching parts with nothing joining them to the ground: the water tower over its roof.
Parts that touch something grounded are grounded, so a stack holds together, and a group is one row,
named by its lowest part.

```ts
[
  {
    mesh: "city/water-tower [wood]",
    parts: 1,
    height: 23.07, // over the ground
    over: "city/building [brick]", // what's directly under it
    clearance: 0.07, // how far it clears that: usually the number to fix
    at: [81.42, 26.42, -78.5],
    count: 45, // identical groups: copies of one prop
  },
];
```

- `ground`: a height (y, default 0), or a target (tag or name) for a terrain or anything uneven, which
  stays out of the rows itself.
- `gap` (default `0.02`): how close counts as touching. Scale it with your units: a city built at
  10× kit scale wants `0.2`.
- `skip`: what flies on purpose (birds, clouds, pickups).
- `tagged`, `tagKey`, `bakes`, as `findZFighting`.

Touching is measured between triangles' bounding boxes, as `measureClearance` measures, which is
generous for sloped faces: a part is only ever called floating when it truly clears what's under it,
but a sloped neighbour can hide one that does. Lines, points and sprites aren't looked at.

### `findSunk(root, options?)`

Parts further under the ground than `depth` (default `0.02`), by their lowest point: `{ mesh, depth,
share, buried, at, count }`. `share` is how much of its height is under, and `buried` means all of it,
so its triangles draw nothing anyone sees. Those come first, then the highest share. Copies fold into
their worst. Takes `ground` as `findFloating` does; a floor that's a solid slab is under its own top,
so pass it as `ground`. A scene on a slope or a terrain needs that too, or it reads as sunk throughout.

### `findUnnamedMeshes(root, options?)`

Visible meshes with no name on themselves or their geometry, most triangles first, so the ones worth
naming come first: `{ mesh, triangles, count }`. Their rows in every other check read
`BoxGeometry [MeshStandardMaterial]`, and can't be found again. `mesh_0`, what a glTF loader calls a
mesh the file left unnamed, counts as unnamed. Options: `skip`, `tagKey`, `bakes`.

### `findShadowIssues(root, options?)`

Shadow setups that draw wrong, read off the scene without rendering, each row a `{ subject, problem,
detail }`, with the live light as a non-enumerable `object`:

| `problem`          | What's wrong                                                                     |
| ------------------ | -------------------------------------------------------------------------------- |
| `shadows-off`      | Lights cast, but `renderer.shadowMap.enabled` is false                           |
| `removed-map-type` | `shadowMap.type` is `PCFSoftShadowMap`, which three replaces with `PCFShadowMap` |
| `no-shadow-light`  | Meshes cast, lights exist, and none of them has `castShadow`                     |
| `no-casters`       | A light casts, and nothing visible has `castShadow`                              |
| `no-receivers`     | A light casts, and nothing visible has `receiveShadow`                           |
| `casters-outside`  | Casters outside its shadow camera                                                |
| `camera-too-big`   | Casters fill under a quarter of its shadow camera (`emptyShare`), wasting texels |
| `no-bias`          | `bias` and `normalBias` are both 0: shadow acne                                  |
| `bias-too-big`     | Bias lifts shadows over 10 texels off what casts them                            |

`renderer` lets it read `shadowMap`; without one, only what the scene says is checked. A shadow
camera fitted around the player leaves what's far away out on purpose, so pass `camera`, the player's:
then only a hole counts, a caster in view and nearer than one it does cover. The camera checks read
the shadow camera's projection matrix, which is what draws: changing `left` and `right` does nothing
until `updateProjectionMatrix()`. Also `skip`.

### `findColorIssues(root, options?)`

Colour management that draws wrong, by texture and slot: `{ subject, problem, detail, materials }`.

| `problem`                          | What's wrong                                                              |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `color-map-as-data`                | `map` or another colour slot with no colour space: washed out             |
| `data-map-as-color`                | `normalMap` or another data slot marked sRGB: its numbers are bent        |
| `background-as-data`               | `scene.background` with no colour space                                   |
| `output-not-srgb`                  | `renderer.outputColorSpace` isn't sRGB (or Display P3): everything's dark |
| `no-exposure`                      | Tone mapping with `toneMappingExposure` at 0 or below: everything's black |
| `environment-without-tone-mapping` | An environment map with no tone mapping: its highlights clip              |

An explicit `LinearSRGBColorSpace` on a colour slot is someone's decision and passes. The last three
need `renderer`. Textures are found by slot, so what only a node material's graph uses goes unchecked.
`environment-without-tone-mapping` is fine when a later pass maps tones. Also `skip`.

### `textureMemory(root, options?)`

What the textures cost on the GPU, worked out from their sizes and formats, with nothing rendered:
`{ bytes, megabytes, rows, unknown }`. Each row is `{ texture, size, format, bytes, share, materials }`,
most bytes first, mipmaps included. It finds them in every material's slots and a shader's uniforms,
hidden objects included (what's uploaded stays uploaded), and `scene.background` and
`scene.environment`. Copies sharing one source upload once and count once. Compressed textures count
what's stored. `unknown` counts images with no size yet, still loading. What only a node material's
graph uses can't be found. `frame.textureMB` in a [budgets](#budgets) file holds it.

### `transparentOverdraw(root, options?)`

Every transparent or additive mesh, point cloud and sprite shades each pixel it covers again, and
nothing culls it: `{ draws, triangles, screens, rows }`. With `camera`, `screens` adds how much of
that camera's view each covers, summed: `3` shades every pixel three more times. It's measured from
each piece's box, so it's an upper bound; a box reaching behind the camera counts as the whole view.
Rows, `{ mesh, draws, triangles, instances, screens }`, come with the most screens first. Also `skip`,
`tagKey`.

### `summarizeScene(root, options?)`

Every check that has one right answer as one count: `{ triangles, draws, meshes, zFighting,
selfZFighting, badGeometry, emptyMeshes, unnamed, shadowIssues, colorIssues }`. `tag` narrows it to
one tagged object. `zFighting: false` skips the slowest check (its counts come back `null`) for a
quick look at a large scene. `renderer` and `camera` go to the shadow and colour checks. Crossing,
floating and sunk parts stay out, since what's right depends on the scene: ask for those by name.

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

Wraps what every draw goes through (`WebGLRenderer.renderBufferDirect`, or `WebGPURenderer`'s
`info.update` on either of its backends) and counts every draw by object name, by group (the name up
to its first `:` or `#`, or your `groupOf(name)`), and by pass: `shadow`, then each `render()` call
by scene name, else its target texture's name, else `render 1`, `render 2`… An unnamed object goes by its named ancestors, type and
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

`{ triangles, draws, zFighting, badGeometry, emptyMeshes, meshes, unnamedMeshes, shadowIssues,
colorIssues, textures, transparent, intersections, floating, sunk }` in one call, `meshes` the
costliest `top` (default 10). `tag` narrows it to one tagged object. `renderer` and `camera` go to
the checks that read them. `intersections` is `null` unless you pass `intersections: true`; `floating`
and `sunk` are `null` unless you pass a `ground`. Rows carry the live mesh as a non-enumerable property
(`row.mesh` on a mesh row, `row.meshes` and `row.pairs` on a z-fighting row, `row.meshes` on a crossing
or floating one, `row.object` on the rest), so they print and serialise without dragging the scene
along.

## Baked groups

[`@zkmake/three-batch`](../three-batch)'s `bake` and `<Baked>` hide the parts and draw one merged
mesh per material. For z-fighting, crossing, floating, sunk and unnamed parts, NaN geometry, empty
meshes, `bbox` and `clearance`, three-audit checks the parts instead of the merge by default
(`bakes: "sources"`). A row then
names the deck and the rail rather than `bridge:steel`, and a part is never compared with its own
merged copy. Parts are found by three-batch's `userData.bakeSource` flag. For bakes from before
that flag, they're the hidden objects inside anything holding a `userData.bakedResult` merge.
`bakes: "merged"` checks what's drawn instead.

Costs (`tris`, `meshes`, `census`, draws, overdraw) and the shadow check always look at what's
drawn: the merge.

## Types

The checks take any object with three's `isObject3D` flag, and the renderer as only the methods
they call. An app on a newer `@types/three` than the one this package was built against passes its
scene and renderer without a cast.

## License

MIT
