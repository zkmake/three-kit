/**
 * Bake a static subtree into one mesh per material. Author a building or a vehicle body as dozens
 * of plain meshes, which read well and cost a draw call each (twice with shadows); a bake merges
 * every one that shares a material, in the root's frame, so the GPU sees a handful of draws.
 *
 * Only for parts that don't move relative to each other. Never baked: instanced and batched meshes,
 * skinned or morphing meshes, multi-material meshes, troika text (it carries no flag; its glyph
 * layout does), hidden subtrees, and anything already a bake's result.
 */
import { type BufferGeometry, type Material, Matrix4, Mesh, type Object3D } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type BakeOptions = {
  /**
   * Attributes to keep; the rest are dropped before merging. Default: those every part in a pile
   * has. A textured part loses its uv if any part sharing its material has none.
   */
  keep?: readonly string[];
  /**
   * Fold a material into a shared pile: write what the material stood for (its colour, its finish)
   * onto the part's vertices and return the pile's material, so parts in many paints merge into
   * one draw. `undefined` keeps the part's own material.
   */
  fold?: (material: Material, geometry: BufferGeometry) => Material | undefined;
  /** Leave an object and its subtree out of the bake. */
  skip?: (object: Object3D) => boolean;
};

export type BakedPile = {
  material: Material;
  /** Every part in this material, merged, in the root's frame. Not indexed. */
  geometry: BufferGeometry;
  castShadow: boolean;
  receiveShadow: boolean;
};

export type BakeResult = {
  piles: BakedPile[];
  /** The meshes the piles were made from. */
  sources: Mesh[];
};

type Pile = { parts: BufferGeometry[]; castShadow: boolean; receiveShadow: boolean };

const isBakeable = (object: Object3D): object is Mesh => {
  const mesh = object as Mesh & {
    isInstancedMesh?: boolean;
    isBatchedMesh?: boolean;
    isSkinnedMesh?: boolean;
  };

  return (
    mesh.isMesh === true &&
    mesh.isInstancedMesh !== true &&
    mesh.isBatchedMesh !== true &&
    mesh.isSkinnedMesh !== true &&
    !("textRenderInfo" in mesh) &&
    !Array.isArray(mesh.material) &&
    mesh.geometry.attributes.position !== undefined &&
    Object.keys(mesh.geometry.morphAttributes).length === 0
  );
};

/** Swap each triangle's second and third corners in every attribute: a mirrored part faces out again. */
const flipWinding = (geometry: BufferGeometry) => {
  for (const attribute of Object.values(geometry.attributes)) {
    const { array, itemSize } = attribute as { array: Float32Array; itemSize: number };

    for (let corner = 0; corner + 2 < attribute.count; corner += 3) {
      for (let k = 0; k < itemSize; k += 1) {
        const b = (corner + 1) * itemSize + k;
        const c = (corner + 2) * itemSize + k;
        const swap = array[b]!;

        array[b] = array[c]!;
        array[c] = swap;
      }
    }
  }
};

/** The attributes every part in a pile has; the rest go. */
const trimToShared = (parts: BufferGeometry[]) => {
  const shared = Object.keys(parts[0]?.attributes ?? {}).filter((name) =>
    parts.every((part) => part.hasAttribute(name)),
  );

  for (const part of parts) {
    for (const name of Object.keys(part.attributes)) {
      if (!shared.includes(name)) {
        part.deleteAttribute(name);
      }
    }
  }
};

/**
 * Merge every bakeable mesh under `root` (not `root` itself) into one geometry per material, in
 * `root`'s frame. Changes nothing in the scene: returns the piles and the meshes they came from.
 */
export const bakePiles = (root: Object3D, options: BakeOptions = {}): BakeResult => {
  const piles = new Map<Material, Pile>();
  const sources: Mesh[] = [];

  const collect = (object: Object3D, parent: Matrix4) => {
    if (
      !object.visible ||
      object.userData.bakedResult === true ||
      options.skip?.(object) === true
    ) {
      return;
    }

    object.updateMatrix();

    const matrix = new Matrix4().multiplyMatrices(parent, object.matrix);

    if (isBakeable(object)) {
      // Non-indexed, so indexed and unindexed parts merge and a mirrored part can be re-wound.
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();

      if (options.keep) {
        for (const name of Object.keys(geometry.attributes)) {
          if (!options.keep.includes(name)) {
            geometry.deleteAttribute(name);
          }
        }
      }

      geometry.applyMatrix4(matrix);

      if (matrix.determinant() < 0) {
        flipWinding(geometry);
      }

      const own = object.material as Material;
      const material = options.fold?.(own, geometry) ?? own;
      const pile = piles.get(material) ?? { parts: [], castShadow: false, receiveShadow: false };

      pile.parts.push(geometry);
      pile.castShadow ||= object.castShadow;
      pile.receiveShadow ||= object.receiveShadow;
      piles.set(material, pile);
      sources.push(object);
    }

    for (const child of object.children) {
      collect(child, matrix);
    }
  };

  for (const child of root.children) {
    collect(child, new Matrix4());
  }

  const baked: BakedPile[] = [];

  for (const [material, pile] of piles) {
    trimToShared(pile.parts);

    const geometry = mergeGeometries(pile.parts, false);

    for (const part of pile.parts) {
      part.dispose();
    }

    if (geometry === null) {
      throw new Error(
        `three-batch: parts in material "${material.name || material.type}" wouldn't merge; their attributes' types disagree (harmonize the sources)`,
      );
    }

    baked.push({
      material,
      geometry,
      castShadow: pile.castShadow,
      receiveShadow: pile.receiveShadow,
    });
  }

  return { piles: baked, sources };
};

/** A pile's mesh name: the bake's, then the material's. Groups as the bake in a draw ledger. */
export const pileName = (name: string, material: Material) =>
  `${name}:${material.name || material.uuid.slice(0, 6)}`;

/**
 * Bake `root` in place: add one mesh per pile to it, flagged `userData.bakedResult`, and hide the
 * sources, flagged `userData.bakeSource`. Returns the function that undoes it: the merged meshes
 * go (and are freed), the sources show again. The sources stay in the scene, so checks that should
 * see parts rather than the merge (`@zkmake/three-audit` does by default) can.
 */
export const bake = (root: Object3D, options: BakeOptions & { name?: string } = {}) => {
  const { piles, sources } = bakePiles(root, options);
  const name = options.name ?? (root.name || "baked");
  const merged = piles.map((pile) => {
    const mesh = new Mesh(pile.geometry, pile.material);

    mesh.name = pileName(name, pile.material);
    mesh.castShadow = pile.castShadow;
    mesh.receiveShadow = pile.receiveShadow;
    mesh.userData.bakedResult = true;

    return mesh;
  });

  for (const source of sources) {
    source.visible = false;
    source.userData.bakeSource = true;
  }

  if (merged.length > 0) {
    root.add(...merged);
  }

  return () => {
    for (const mesh of merged) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }

    for (const source of sources) {
      source.visible = true;
      delete source.userData.bakeSource;
    }
  };
};
