/**
 * Scene-graph plumbing every check shares: the walk, mesh kinds, triangle counts, tags and names.
 *
 * Nothing here imports three at runtime; objects are recognised by three's own `is*` flags, so the
 * checks work on whatever copy of three the app bundles.
 */
import type { BatchedMesh, BufferGeometry, InstancedMesh, Material, Mesh, Object3D } from "three";

/**
 * Any three.js object, from whichever copy of three's types the app has. The checks take this, so
 * an app on a newer `@types/three` than this package was built against passes its scene as is.
 */
export type AnyObject3D = { readonly isObject3D: true; readonly children: readonly object[] };

/** The object as three's own type, for the walk. */
export const asObject3D = (object: AnyObject3D) => object as unknown as Object3D;

/** Leave an object and everything under it out of a check. */
export type Skip = (object: Object3D) => boolean;

/**
 * What a check sees of a bake (`@zkmake/three-batch`'s `bake` and `<Baked>`), which hides its
 * parts and draws one merged mesh per material instead. `sources`: the parts, as if shown, and not
 * the merge, so rows name real parts. `merged`: what the renderer draws.
 */
export type Bakes = "sources" | "merged";

export type WalkOptions = {
  skip?: Skip | undefined;
  /** Prune hidden objects and their subtrees, as the renderer does. */
  visibleOnly?: boolean;
  /** With `sources`: prune bake results, and walk the parts a bake hid as though visible. */
  bakes?: Bakes | undefined;
};

/**
 * A part a bake hid in favour of its merge: flagged `userData.bakeSource` by three-batch, or (for
 * bakes from before that flag) inside an object that holds a `userData.bakedResult` merge.
 */
export const isBakeSource = (object: Object3D) => {
  if (object.userData.bakeSource === true) {
    return true;
  }

  for (let at = object.parent; at; at = at.parent) {
    if (at.children.some((child) => child.userData.bakedResult === true)) {
      return true;
    }
  }

  return false;
};

/** Depth-first, in child order. A skipped (or, with `visibleOnly`, hidden) object prunes its subtree. */
export const walk = (root: Object3D, options: WalkOptions, visit: (object: Object3D) => void) => {
  const stack = [root];
  const sources = options.bakes === "sources";

  while (stack.length > 0) {
    const object = stack.pop()!;

    if (
      (sources && object.userData.bakedResult === true) ||
      (options.visibleOnly === true && !object.visible && !(sources && isBakeSource(object))) ||
      options.skip?.(object) === true
    ) {
      continue;
    }

    visit(object);

    for (let i = object.children.length - 1; i >= 0; i -= 1) {
      stack.push(object.children[i]!);
    }
  }
};

export const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true;

/** Anything the renderer draws: a mesh, line, point cloud or sprite. */
export const isDrawable = (object: Object3D) => {
  const flags = object as Partial<Record<"isMesh" | "isLine" | "isPoints" | "isSprite", boolean>>;

  return (
    flags.isMesh === true ||
    flags.isLine === true ||
    flags.isPoints === true ||
    flags.isSprite === true
  );
};

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

/**
 * A batch's visible instances by the geometry each draws: how many, and that geometry's triangles
 * (its range in the shared buffer). In first-drawn order.
 */
export const batchedGeometries = (batch: BatchedMesh) => {
  const geometries = new Map<number, { instances: number; triangles: number }>();

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

    const known = geometries.get(geometryId);

    if (known) {
      known.instances += 1;
      continue;
    }

    const range = batch.getGeometryRangeAt(geometryId) as {
      count?: number;
      indexCount: number;
      vertexCount: number;
    };
    const elements = range.count ?? (batch.geometry.index ? range.indexCount : range.vertexCount);

    geometries.set(geometryId, { instances: 1, triangles: Math.floor(elements / 3) });
  }

  return geometries;
};

/** Triangles a batch draws across its visible instances, and how many instances that is. */
export const batchedTriangles = (batch: BatchedMesh) => {
  let triangles = 0;
  let instances = 0;

  for (const geometry of batchedGeometries(batch).values()) {
    triangles += geometry.triangles * geometry.instances;
    instances += geometry.instances;
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

/**
 * A skip that keeps only what's tagged `tag`: prunes objects tagged otherwise, and meshes outside
 * any object tagged `tag`. Throws when nothing under `root` carries the tag.
 */
export const onlyTag = (root: Object3D, tag: string, tagKey: string, skip?: Skip): Skip => {
  let found = false;

  walk(root, { skip }, (object) => {
    const own: unknown = object.userData[tagKey];

    found ||= own !== undefined && own !== null && String(own) === tag;
  });

  if (!found) {
    throw new Error(`three-audit: nothing is tagged userData.${tagKey} = "${tag}"`);
  }

  return (object) => {
    if (skip?.(object) === true) {
      return true;
    }

    const own: unknown = object.userData[tagKey];

    if (own !== undefined && own !== null && String(own) !== tag) {
      return true;
    }

    return isDrawable(object) && tagOf(object, tagKey) !== tag;
  };
};

export const hasTag = (root: Object3D, tagKey: string, skip?: Skip) => {
  let found = false;

  walk(root, { skip }, (object) => {
    found ||= object.userData[tagKey] !== undefined && object.userData[tagKey] !== null;
  });

  return found;
};

export const meshName = (mesh: Mesh) => mesh.name || mesh.geometry.name || mesh.geometry.type;

/**
 * The named ancestors above an object, outermost first, from `root` (included when named) down:
 * at most the nearest `depth`, with `…` for the rest. An unnamed ancestor carrying `tagKey` goes
 * by its tag.
 */
export const pathOf = (object: Object3D, root: Object3D | null, tagKey?: string, depth = 3) => {
  const names: string[] = [];

  for (let at = object.parent; at; at = at === root ? null : at.parent) {
    const tag: unknown = tagKey === undefined ? undefined : at.userData[tagKey];
    const name = at.name || (tag === undefined || tag === null ? "" : String(tag));

    if (name) {
      names.unshift(name);
    }
  }

  return names.length > depth ? ["…", ...names.slice(-depth)] : names;
};

/** `path/to/mesh [material]`: enough to find a mesh in the scene without walking it by hand. */
export const meshLabel = (mesh: Mesh, root: Object3D | null, tagKey?: string) =>
  `${[...pathOf(mesh, root, tagKey), meshName(mesh)].join("/")} [${materialName(mesh)}]`;

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
