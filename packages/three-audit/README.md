# @zkmake/three-audit

Checks for a three.js scene: what it costs and what's wrong with it. Triangle counts, the meshes and
geometries behind them, z-fighting, NaN geometry, black frames, and a ledger of every draw call in
one frame. Zero dependencies. The geometry checks need no renderer, so they run in a unit test as
well as the browser console.

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

## From the command line

Check exported models without writing any code:

```sh
npx @zkmake/three-audit assets/*.glb   # or bunx
```

```
windmill.glb  4,812 triangles
  ✗ 1 z-fighting pair
      windmill/plinth [stone] @ (0, 0.1, 0)
    ↔ windmill/wall [plaster] @ (0, 0.5, 0)
      4 triangles in y = 0.000, facing -y; overlap 1 m² at (0, 0, 0)
  ✓ no NaN geometry
  most triangles:
          1,920  sails
            …
```

It exits 1 when any model fails a check (2 when one can't be read), so it can gate CI. Options:
`--gap <m>`, `--self`, `--skip <regex>` (leave out objects by name, e.g. decals), `--top <n>`,
`--json`, `--no-fail`.

`.glb` and `.gltf` (buffers beside it) both load. Textures are stripped first: no check reads them.
Draco models need `draco3dgltf` installed and Meshopt models `meshoptimizer`
(`npx -p @zkmake/three-audit -p draco3dgltf three-audit model.glb`).

In a test, load a model the same way:

```ts
import { findZFighting } from "@zkmake/three-audit";
import { loadModel } from "@zkmake/three-audit/node";

test("windmill.glb has no z-fighting", async () => {
  expect(findZFighting(await loadModel("assets/windmill.glb"))).toEqual([]);
});
```

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

| Global                | Returns                                                                             |
| --------------------- | ----------------------------------------------------------------------------------- |
| `tris()`              | Triangles one pass draws: visible meshes, instances and batches counted, no culling |
| `meshes()`            | Every visible mesh: triangles, instances, total, most first                         |
| `census()`            | Geometries by triangles drawn, hidden meshes included                               |
| `audit()`             | Meshes with NaN positions or normals, or zero-length normals                        |
| `zfight(gap?, self?)` | Pairs of meshes that z-fight                                                        |
| `report()`            | All of the above in one JSON-safe object                                            |
| `ledger(options?)`    | One frame's draw calls by object and pass, printed as tables (WebGL)                |
| `beginLedger()`       | `{ end() }`: draw calls between the two, for any span you choose (WebGL)            |
| `blackFrames(10)`     | Frames in the next 10 s that came out black (WebGL)                                 |

Each one is also on `threeAudit` (`threeAudit.report()`). Where short names like `report` collide
with other tooling, `installAuditHelpers(scene, { globals: false })` installs only `threeAudit`.

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

- hidden objects
- instanced and batched meshes, and `InstancedBufferGeometry`, which a shader positions. Check
  their source parts as plain meshes.
- pairs where neither material writes depth, or one ignores depth entirely. A decal that doesn't
  write depth, over a wall that does, still fights and is still listed.
- pairs where either material has a polygon offset, the usual decal fix

Typical fixes: stand the smaller part 5 mm off, shorten it inside the larger one, or fit panels
between each other instead of over each other's ends.

### `findBadGeometry(root, options?)`

Vertices with a non-finite position or normal, and zero-length normals on triangles with area.
Either lights a pixel NaN, and bloom smears one NaN pixel into a black block.

### `countTriangles`, `listMeshes`, `geometryCensus`

Where a triangle budget goes. Name meshes and geometries (`mesh.name`, `geometry.name`) so the rows
say something. A mesh row's `name` is its named ancestors, then its own name, or its geometry's name
or type when it has none (`CharacterHands/left/BoxGeometry`). Draw ranges are respected; a shadow pass adds roughly as much again per light.

### `recordDrawLedger(renderer)` / `beginDrawLedger(renderer)`

Wraps `WebGLRenderer.renderBufferDirect` and counts every draw by object name, by group (the name up
to its first `:` or `#`), and by pass: `shadow`, then each `render()` call by scene name, or
`render 1`, `render 2`… An unnamed object goes by its named ancestors, type and material
(`CharacterHands/Mesh [skin]`).

`recordDrawLedger` records exactly one animation frame, and fails after `timeout` (2 s) when no
frame comes. `{ render }` records one call of your own render instead, frames or not.
`beginDrawLedger` returns `{ end() }` for any span. `printDrawLedger` prints the tables.

### `watchBlackFrames(renderer)`

After each render to the screen, reads a 3 × 3 grid of pixels and counts frames where three or more
are pure black. Use a visible browser: headless ones haven't reproduced black frames. Each read
stalls the GPU, so watch, read `blackFrames`, `stop()`.

### `auditScene(root, options?)`

`{ triangles, zFighting, badGeometry, meshes }` in one call. Rows carry the live mesh as a
non-enumerable property (`row.mesh`, `row.meshes`), so they print and serialise without dragging the
scene along.

## Types

The checks take any object with three's `isObject3D` flag, and the renderer as only the methods
they call. An app on a newer `@types/three` than the one this package was built against passes its
scene and renderer without a cast.

## License

MIT
