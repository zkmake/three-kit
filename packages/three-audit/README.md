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

A failure lists each pair of meshes with faces in one plane, facing the same way, overlapping:

```
[{ a: "windmill/plinth [stone] @ (0, 0.1, 0)", b: "windmill/wall [plaster] @ (0, 0.5, 0)", triangles: 4 }]
```

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
| `ledger()`            | One frame's draw calls by object and pass, printed as tables (WebGL)                |
| `blackFrames(10)`     | Frames in the next 10 s that came out black (WebGL)                                 |

From a headless browser: `agent-browser eval 'JSON.stringify(report())'`.

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

Instanced and batched meshes are skipped: check their source parts as plain meshes.

Typical fixes: stand the smaller part 5 mm off, shorten it inside the larger one, or fit panels
between each other instead of over each other's ends.

### `findBadGeometry(root, options?)`

Vertices with a non-finite position or normal, and zero-length normals on triangles with area.
Either lights a pixel NaN, and bloom smears one NaN pixel into a black block.

### `countTriangles`, `listMeshes`, `geometryCensus`

Where a triangle budget goes. Name meshes and geometries (`mesh.name`, `geometry.name`) so the rows
say something. Draw ranges are respected; a shadow pass adds roughly as much again per light.

### `recordDrawLedger(renderer)` / `beginDrawLedger(renderer)`

Wraps `WebGLRenderer.renderBufferDirect` and counts every draw by object name, by group (the name up
to its first `:` or `#`), and by pass: `shadow`, then each `render()` call by scene name, or
`render 1`, `render 2`… `recordDrawLedger` records exactly one animation frame; `beginDrawLedger`
returns `{ end() }` for any span. `printDrawLedger` prints the tables.

### `watchBlackFrames(renderer)`

After each render to the screen, reads a 3 × 3 grid of pixels and counts frames where three or more
are pure black. Use a visible browser: headless ones haven't reproduced black frames. Each read
stalls the GPU, so watch, read `blackFrames`, `stop()`.

### `auditScene(root, options?)`

`{ triangles, zFighting, badGeometry, meshes }` in one call. Rows carry the live mesh as a
non-enumerable property (`row.mesh`, `row.meshes`), so they print and serialise without dragging the
scene along.

## License

MIT
