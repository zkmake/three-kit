/**
 * One draw per material for many objects that move on their own: a train's cars, a fleet, a crowd
 * of props. Each object hands its geometry in (baked or not); the batch keeps one `BatchedMesh`
 * per material and copies each object's world matrix onto its instance before every render, so
 * the objects move as usual and the GPU sees a handful of draws. Each instance is still culled on
 * its own.
 *
 * Members with a far copy switch between the two by their distance from the camera. The update
 * runs from the batch's own `onBeforeShadow` and `onBeforeRender`, after the scene's matrices are
 * current and before the shadow pass, so there is nothing to call each frame and no frame-loop
 * ordering to get right.
 */
import {
  BatchedMesh,
  type BufferGeometry,
  type Camera,
  Group,
  type Material,
  type Object3D,
  Vector3,
} from "three";

import { addGeometryWithRoom, addInstanceWithRoom } from "./batch.ts";
import { type Level, type LevelOptions, levelFor, pinnedLevel } from "./levels.ts";

export type FollowMember = {
  /** The object the instance follows. Its world matrix places the geometry. */
  object: Object3D;
  geometry: BufferGeometry;
  /** A simplified copy to draw from `lod.distance` out. */
  far?: BufferGeometry | null | undefined;
  material: Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
};

export type FollowBatchOptions = {
  name?: string;
  /** When far copies draw. Without it, members with a far copy always draw it. */
  lod?: LevelOptions;
  /** Starting room per batch; batches grow as members join. */
  instances?: number;
  vertices?: number;
  /** Called on each `BatchedMesh` as it's made: layers, render order, custom depth materials. */
  configure?: (mesh: BatchedMesh) => void;
};

type Member = {
  object: Object3D;
  near: number;
  far: number | null;
  instanceId: number;
  level: Level;
};

type Batch = { mesh: BatchedMesh; members: Set<Member> };

const at = new Vector3();
const eye = new Vector3();

/** A sequential index for an unindexed copy: a batch's geometries are all indexed. */
const indexed = (geometry: BufferGeometry) => {
  if (geometry.index) {
    return geometry;
  }

  const copy = geometry.clone();

  copy.setIndex(Array.from({ length: geometry.attributes.position?.count ?? 0 }, (_, i) => i));

  return copy;
};

export class FollowBatch {
  /** Add this to the scene. It holds one `BatchedMesh` per material. */
  readonly group = new Group();
  private readonly batches = new Map<Material, Batch>();
  private readonly options: FollowBatchOptions;

  constructor(options: FollowBatchOptions = {}) {
    this.options = options;
    this.group.name = options.name ?? "follow-batch";
  }

  /**
   * Draw `member.geometry` wherever `member.object` is. The batch copies the geometry, so the
   * caller may dispose its own. Returns the function that takes the member out again.
   */
  add(member: FollowMember): () => void {
    const batch = this.batchFor(member.material);
    const near = addGeometryWithRoom(batch.mesh, indexed(member.geometry));
    const far = member.far ? addGeometryWithRoom(batch.mesh, indexed(member.far)) : null;
    const instanceId = addInstanceWithRoom(batch.mesh, far ?? near);
    const entry: Member = {
      object: member.object,
      near,
      far,
      instanceId,
      level: far === null ? "near" : "far",
    };

    batch.mesh.castShadow ||= member.castShadow === true;
    batch.mesh.receiveShadow ||= member.receiveShadow === true;
    batch.members.add(entry);

    return () => {
      if (!batch.members.delete(entry)) {
        return;
      }

      batch.mesh.deleteInstance(instanceId);
      batch.mesh.deleteGeometry(near);

      if (far !== null) {
        batch.mesh.deleteGeometry(far);
      }
    };
  }

  /** Copy every member's world matrix onto its instance and pick its level for `camera`. */
  update(camera?: Camera) {
    for (const batch of this.batches.values()) {
      this.updateBatch(batch, camera);
    }
  }

  /** Remove the batches from the scene and free them. */
  dispose() {
    for (const { mesh } of this.batches.values()) {
      mesh.removeFromParent();
      mesh.dispose();
    }

    this.batches.clear();
  }

  private updateBatch({ mesh, members }: Batch, camera?: Camera) {
    if (camera) {
      eye.setFromMatrixPosition(camera.matrixWorld);
    }

    for (const member of members) {
      // The renderer brings the scene's matrices up to date before drawing, but a member moved
      // since (or outside the scene) needs its own.
      member.object.updateWorldMatrix(true, false);
      mesh.setMatrixAt(member.instanceId, member.object.matrixWorld);

      if (member.far === null || !camera) {
        continue;
      }

      const lod = this.options.lod;
      const level = lod
        ? levelFor(
            at.setFromMatrixPosition(member.object.matrixWorld).distanceTo(eye),
            member.level,
            lod,
          )
        : (pinnedLevel() ?? "far");

      if (level !== member.level) {
        member.level = level;
        mesh.setGeometryIdAt(member.instanceId, level === "near" ? member.near : member.far);
      }
    }
  }

  private batchFor(material: Material) {
    const existing = this.batches.get(material);

    if (existing) {
      return existing;
    }

    const vertices = this.options.vertices ?? 4096;
    const mesh = new BatchedMesh(this.options.instances ?? 8, vertices, vertices * 3, material);
    const batch: Batch = { mesh, members: new Set() };

    mesh.name = `${this.group.name}:${material.name || material.uuid.slice(0, 6)}`;
    // Culled per instance by the batch; its own sphere would go stale as members move.
    mesh.frustumCulled = false;

    // Before three's own culling and sorting, so they see this frame's matrices. three's
    // `onBeforeShadow` is its `onBeforeRender` from the shadow camera; call that directly, or the
    // wrapper below would pick levels by the light's distance instead of the camera's.
    const cull = BatchedMesh.prototype.onBeforeRender.bind(mesh);

    mesh.onBeforeShadow = (renderer, _object, camera, shadowCamera, geometry, depthMaterial) => {
      this.updateBatch(batch, camera);
      cull(renderer, null as never, shadowCamera, geometry, depthMaterial, null as never);
    };
    mesh.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      this.updateBatch(batch, camera);
      cull(renderer, scene, camera, geometry, material, group);
    };

    this.options.configure?.(mesh);
    this.batches.set(material, batch);
    this.group.add(mesh);

    return batch;
  }
}
