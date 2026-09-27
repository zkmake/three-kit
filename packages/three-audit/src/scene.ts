/**
 * Scene-graph plumbing every check shares: the walk, mesh kinds, triangle counts, tags and names.
 *
 * Nothing here imports three at runtime; objects are recognised by three's own `is*` flags, so the
 * checks work on whatever copy of three the app bundles.
 */
import type { BatchedMesh, BufferGeometry, InstancedMesh, Material, Mesh, Object3D } from "three";

/** Leave an object and everything under it out of a check. */
export type Skip = (object: Object3D) => boolean;

export type WalkOptions = {
  skip?: Skip | undefined;
  /** Prune hidden objects and their subtrees, as the renderer does. */
  visibleOnly?: boolean;
};

/** Depth-first, in child order. A skipped (or, with `visibleOnly`, hidden) object prunes its subtree. */
export const walk = (root: Object3D, options: WalkOptions, visit: (object: Object3D) => void) => {
  const stack = [root];

  while (stack.length > 0) {
    const object = stack.pop()!;

    if ((options.visibleOnly === true && !object.visible) || options.skip?.(object) === true) {
      continue;
    }

    visit(object);

    for (let i = object.children.length - 1; i >= 0; i -= 1) {
      stack.push(object.children[i]!);
    }
  }
};

export const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true;

export const isInstanced = (mesh: Mesh): mesh is InstancedMesh =>
  (mesh as InstancedMesh).isInstancedMesh === true;

export const isBatched = (mesh: Mesh): mesh is BatchedMesh =>
  (mesh as unknown as BatchedMesh).isBatchedMesh === true;

/** Triangles one draw of this geometry makes: indexed or not, within its draw range. */
export const triangleCount = (geometry: BufferGeometry) => {
  const elements = geometry.index?.count ?? geometry.attributes.position?.count ?? 0;
  const { start, count } = geometry.drawRange;
  const drawn = Math.min(elements, start + count) - start;

  return Math.max(0, Math.floor(drawn / 3));
};

/** Triangles a batch draws across its visible instances, and how many instances that is. */
export const batchedTriangles = (batch: BatchedMesh) => {
  let triangles = 0;
  let instances = 0;

  for (let id = 0; id < batch.maxInstanceCount; id += 1) {
    let geometryId: number;

    // Deleted and never-used ids throw.
    try {
      if (!batch.getVisibleAt(id)) {
        continue;
      }

      geometryId = batch.getGeometryIdAt(id);
    } catch {
      continue;
    }

    const range = batch.getGeometryRangeAt(geometryId) as {
      count?: number;
      indexCount: number;
      vertexCount: number;
    };
    const elements = range.count ?? (batch.geometry.index ? range.indexCount : range.vertexCount);

    triangles += Math.floor(elements / 3);
    instances += 1;
  }

  return { instances, triangles };
};

/** The tag of the nearest tagged ancestor (the object itself included), or `null`. */
export const tagOf = (object: Object3D, tagKey: string) => {
  for (let at: Object3D | null = object; at; at = at.parent) {
    const tag: unknown = at.userData[tagKey];

    if (tag !== undefined && tag !== null) {
      return String(tag);
    }
  }

  return null;
};

export const hasTag = (root: Object3D, tagKey: string, skip?: Skip) => {
  let found = false;

  walk(root, { skip }, (object) => {
    found ||= object.userData[tagKey] !== undefined && object.userData[tagKey] !== null;
  });

  return found;
};

export const meshName = (mesh: Mesh) => mesh.name || mesh.geometry.name || mesh.geometry.type;

export const materialName = (mesh: Mesh) => {
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
    | Material
    | undefined;

  return material ? material.name || material.type : "none";
};

/** Adds a property JSON and `console.table` leave out: a live object that would serialise the scene. */
export const withHidden = <Row extends object, Key extends string, Value>(
  row: Row,
  key: Key,
  value: Value,
) => Object.defineProperty(row, key, { value, enumerable: false }) as Row & Record<Key, Value>;
