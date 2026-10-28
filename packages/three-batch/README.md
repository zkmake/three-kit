# @zkmake/three-batch

Fewer draw calls and fewer triangles for three.js scenes. Culling cells for meshes that span the
world, static bakes, batches that follow moving objects, per-frame instance pools, far copies made
with meshoptimizer, and `harmonize` for geometries that refuse to merge. Vanilla three and React
Three Fiber.

```sh
bun add @zkmake/three-batch   # or npm i / pnpm add
```

What it did in [keyboard-express](https://github.com/zkmake), where it comes from:

| Tool                     | Before → after                                  |
| ------------------------ | ----------------------------------------------- |
| `chunkInstances` (128 m) | 608k → 169k triangles a frame                   |
| `<Baked>`                | ~400 → ~150 draw calls                          |
| `simplify` far copies    | train 88.5k → ~40k triangles, no visible change |
| `InstancePool` (wheels)  | 140 → ~27 draw calls                            |

Entries: `@zkmake/three-batch` (vanilla, no dependencies but three), `@zkmake/three-batch/lod`
(needs `meshoptimizer`), `@zkmake/three-batch/react` (needs `react` and `@react-three/fiber`).

## Culling cells

A static `InstancedMesh` or merged geometry spread over the whole world has one bounding sphere, so
three never culls it: every instance draws every frame, in the shadow pass too. Split it into cells
with their own bounds:

```ts
import { chunkInstances, chunkMesh } from "@zkmake/three-batch";

scene.add(chunkInstances(grass, { size: 128 })); // an x-by-z grid; axes: "x" or "z" for strips
scene.add(chunkMesh(ground, { size: 128 }));
```

Cells are named `<name>#<cell>`, in a group standing where the mesh stood. `chunkInstances` shares
the geometry and material and disposes the original's instance buffers (a per-instance attribute on
the geometry can't be split, and throws); `disposeChunks(group)` frees the cells' instance buffers.
`chunkGeometry` returns the pieces of one geometry (sharing its vertex buffers). Only for things
built once: anything that moves its instances stays whole.

## Bakes

Author a building as dozens of plain meshes; bake merges every one that shares a material, so it
draws as a handful:

```tsx
import { Baked } from "@zkmake/three-batch/react";

<Baked name="station">
  <mesh geometry={wall} material={brick} />
  <mesh geometry={roof} material={slate} position={[0, 3, 0]} />
  {/* …dozens more */}
</Baked>;
```

Vanilla: `const undo = bake(group)`, its meshes named `<name>:<material>` (`name` defaults to the
group's). The parts stay in the scene, hidden and flagged `userData.bakeSource`, and the merged
meshes are flagged `userData.bakedResult`. Checks that want parts can use them instead of the
merge: [`@zkmake/three-audit`](../three-audit) does by default.
`bakePiles(group)` returns the merged piles and their sources without touching the scene.

- Never baked: instanced, batched, skinned and morphing meshes, multi-material meshes, troika text,
  hidden subtrees, a bake's own results, and what `skip: (object) => boolean` leaves out.
- Mirrored parts (negative scale) are re-wound so they still face out.
- Attributes: a pile keeps those all its parts share, or `keep: ["position", "normal"]`.
- `fold: (material, geometry) => material`: write a material's colour and finish onto the part's
  vertices and return a shared material, so parts in many paints merge into one draw.

`<Baked>` takes the same options as props, bakes once per mount (change its `key` to bake again)
and undoes it on unmount. With `far` it makes a far copy per pile: under a `<FollowBatchProvider>`
the batch switches them (below); otherwise each pile is a `THREE.LOD`, by `lod={{ distance,
hysteresis }}` (default 30 units out). `FarCopiesContext` set to `false` turns far copies off below
it, e.g. for a close-up thumbnail.

## Batches that follow moving objects

A train's cars, a fleet, a crowd: one `BatchedMesh` per material for all of them, each instance
following its object. It updates itself before every render (shadow pass included), so there's no
frame callback or priority to get right.

```tsx
import { simplify } from "@zkmake/three-batch/lod";
import { Baked, FollowBatchProvider } from "@zkmake/three-batch/react";

<FollowBatchProvider name="train" lod={{ distance: 30 }}>
  {cars.map((car) => (
    <RigidBody key={car.id}>
      <Baked name={car.id} far={(g) => simplify(g, 0.02)}>
        <Wagon />
      </Baked>
    </RigidBody>
  ))}
</FollowBatchProvider>;
```

Vanilla: `const batch = new FollowBatch({ lod }); scene.add(batch.group); batch.add({ object,
geometry, material, far })`, which returns the function that takes the member out. Without `lod`, a
member with a far copy always draws it. Batches grow as members join (`addGeometryWithRoom`
repacks, then doubles); `instances` and `vertices` set their starting room, `configure(mesh)` sets
up each `BatchedMesh` as it's made. Seed shader noise by instance id, not world position, or the
texture slides as things move.

For a `BatchedMesh` of your own: `createBatch(geometries, material)` sizes one for exactly those
geometries and returns `{ mesh, ids }`; `addGeometryWithRoom` and `addInstanceWithRoom` add to one
that may be full.

## Instance pools

Copies refilled every frame, all parts sharing the matrices:

```ts
import { InstancePool } from "@zkmake/three-batch";

// each part a { geometry, material }
const wheels = new InstancePool([tyre, hub, spokes], { name: "wheels" });

scene.add(wheels.group);
// each frame:
wheels.begin();
for (const axle of axles) wheels.push(axle.matrixWorld);
wheels.end();
```

Matrices are in the group's frame. The pool starts with room for `capacity` (default 16) and doubles
when a frame pushes past it. It isn't frustum-culled unless `cull: true`, which recomputes its
bounds every `end()`; `configure(mesh)` sets shadows or layers on each part's `InstancedMesh`.
`dispose()` frees them.

## Far copies (`/lod`)

```ts
import { simplify, simplifyReport, weld } from "@zkmake/three-batch/lod";

const far = simplify(weld(geometry), 0.02); // within 2 cm of the surface; null if it saves < 10%
```

Importing `/lod` waits the few milliseconds meshoptimizer's embedded wasm takes to start (nothing is
fetched). `simplify` takes an indexed geometry: `weld` (also on the main entry) merges coincident
vertices first. `{ minSaving }` changes the 10%.

The far copy shares the full one's vertex buffers under a shorter index, so colours and normals
carry over. Creases survive: welding keeps split normals, which the simplifier treats as seams.
Pick the error from your camera so what's lost is under a pixel. `simplifyReport(root, [0.01,
0.02])` shows what each error would leave before you wire one in: per tagged object
(`userData.studioObject`, or `{ tagKey }`), triangles in full and at each error.

Switching: `levelFor(distance, current, { distance, hysteresis })`, with a margin (default 1.5
units) so an object on the threshold doesn't flicker. `pinLevel("far")` pins every switch (a
studio's `?lod=far`), `pinLevel(null)` lets go, and `pinnedLevel()` reads it.

## Harmonize

`mergeGeometries` and `BatchedMesh` refuse parts that disagree: indexed beside unindexed, uv here
and not there, byte colours beside float ones. `harmonize(geometries)` returns copies that agree,
filling what a part lacks (colour white, normals computed, anything else zeros or `fill`). All end
up indexed if any part is, or as `indexed` says; morph targets are dropped.

## License

MIT
