# Fixes, by symptom

Find what the survey showed, then take the first fix that keeps the look from every play position. Each names the kit's call; its README has the signature. A fix the project already made elsewhere (the style guide's _Construction_ and _Pitfalls_) comes before anything new.

## Triangles

- **One mesh over the whole world**: a static `InstancedMesh` or merged geometry with one bounds, drawn whole at every play position (its ledger row never changes, its name has no `#<cell>`). Split it into culling cells: `chunkInstances` / `chunkMesh` (three-batch), sized so a cell is a fraction of the view. Each visible cell is a draw: check draws against `frame.calls`.
- **A batch with per-object culling off**: every instance draws. Turn `perObjectFrustumCulled` on unless draw order matters (a depth sort already runs).
- **Far things at near detail**: scatter, props or vehicles seen 100+ units off at full triangles.
  1. A far copy by distance: `simplify(weld(geometry), error)` (three-batch `/lod`), the error under a pixel at that distance; `simplifyReport` shows what each error leaves; `levelFor` switches with hysteresis; `FollowBatch`'s `lod` for moving copies.
  2. Colour areas smaller than the error (windows, trim, a tyre beside its hub): simplify with seams kept (`weld` keeps split normals and uvs as seams), only the parts that carry the triangles, or take the colour off the uvs with an impostor.
  3. Seen only from far: ship the simplified copy as the only geometry.
- **Drawn past the fog**: scatter wholly past the fog's far depth draws in fog colour over the same sky. Hide it per instance by depth along the view (three's fog is depth, not distance), with its bounds and a margin for what moves.
- **Geometry the camera never reaches**: a planet's far side, a building's back, an underside. Crop it to what the play positions and the fog can show.
- **Relief seen face on**: teeth, bolts, planks a few pixels each. Paint them as colour on a flat face or in the shader.
- **A pool drawn whole**: an instance pool or particle buffer drawing its capacity. Set `count` (or the draw range) to what's live.

## Draws

- **Many static parts**: bake them, one draw per material: `bake` / `<Baked>` (three-batch); `fold` writes each paint onto vertices so many paints share one material; `harmonize` when geometries refuse to merge.
- **Many moving copies of one model** (a fleet, a crowd, a train's cars): `FollowBatch` / `<FollowBatchProvider>`, one `BatchedMesh` per material following each object.
- **Copies refilled every frame** (wheels, debris): `InstancePool`.
- **Culling cells too small**: each visible cell is a draw; grow `size`.

## The shadow pass

- **Casters that can't cast into view**: small or distant things, a far city. `castShadow` off for them; keep the shadow camera's box as tight as the play view allows. `passStats`' shadow `objects` lists who casts.
- **A batch drawn whole in the shadow pass**: three culls a batch per instance against the shadow camera only when its bounds and per-object culling are right; check the shadow row moves with the play position.

## Pixels

- **Fullscreen passes** (`fullscreenPasses`, `fullscreenPixels`): merge effects into fewer passes, run them at a lower resolution, or drop one the play view can't tell apart (pixel diff).
- **Expensive fragments over many pixels**: a far or small surface on a heavy material. A cheaper material there (Lambert or basic for what's lit flat), fewer lights reaching it, detail that fades out with distance.
- **Device pixel ratio**: cap it (≤ 2) before cutting the scene.

## Loading, bytes, memory

- **Many small files**: pack the models a level places into one `.glb` (meshopt-compressed), load the shared palette once, preload every file at import so they fetch in parallel.
- **Load-time geometry work** (merging, far copies, impostors): bake it at build time and ship the result; time any pass that must stay at load.
- **Extra detail levels cost bytes**: each far copy or impostor ships. Share one copy between levels with the same error, and count the file's growth in the report.
- **Textures**: `@zkmake/three-textures` lists what the scene samples, at what size; a texture larger than it is ever drawn is memory spent for nothing.
- **Heap climbing between play positions**: something built per position and never disposed. Find it with `renderer.info.memory` before and after, and dispose what's left behind.
