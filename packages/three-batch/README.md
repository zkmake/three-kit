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

scene.add(chunkInstances(grass, { size: 128 })); // an x-by-z grid; axes: "x" for strips along a track
scene.add(chunkMesh(ground, { size: 128 }));
```

Cells are named `<name>#<cell>`. `chunkGeometry` returns the pieces of one geometry (sharing its
vertex buffers). Only for things built once: anything that moves its instances stays whole.

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

Vanilla: `const undo = bake(group)`. The parts stay in the scene, hidden and flagged
`userData.bakeSource`, and the merged meshes are flagged `userData.bakedResult`. Checks that want
parts can use them instead of the merge: [`@zkmake/three-audit`](../three-audit) does by default.

- Never baked: instanced, batched, skinned and morphing meshes, multi-material meshes, troika text,
  hidden subtrees, and a bake's own results.
- Mirrored parts (negative scale) are re-wound so they still face out.
- Attributes: a pile keeps those all its parts share, or `keep: ["position", "normal"]`.
- `fold(material, geometry)`: write a material's colour and finish onto the part's vertices and
  return a shared material, so parts in many paints merge into one draw.

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
geometry, material, far })`. Batches grow as members join (`addGeometryWithRoom` repacks, then
doubles). Seed shader noise by instance id, not world position, or the texture slides as things
move.

## Instance pools

Copies refilled every frame, all parts sharing the matrices:

```ts
const wheels = new InstancePool([tyre, hub, spokes], { name: "wheels" });

scene.add(wheels.group);
// each frame:
wheels.begin();
for (const axle of axles) wheels.push(axle.matrixWorld);
wheels.end();
```

## Far copies (`/lod`)

```ts
import { simplify, simplifyReport, weld } from "@zkmake/three-batch/lod";

const far = simplify(weld(geometry), 0.02); // within 2 cm of the surface; null if it saves < 10%
```

The far copy shares the full one's vertex buffers under a shorter index, so colours and normals
carry over. Creases survive: welding keeps split normals, which the simplifier treats as seams.
Pick the error from your camera so what's lost is under a pixel. `simplifyReport(root, [0.01,
0.02])` shows what each error would leave, per tagged object, before you wire one in.

Switching: `levelFor(distance, current, { distance, hysteresis })`, with a margin so an object on
the threshold doesn't flicker. `pinLevel("far")` pins every switch (a studio's `?lod=far`).

## Harmonize

`mergeGeometries` and `BatchedMesh` refuse parts that disagree: indexed beside unindexed, uv here
and not there, byte colours beside float ones. `harmonize(geometries)` returns copies that agree,
filling what a part lacks (colour white, normals computed, anything else zeros or `fill`).

## License

MIT
