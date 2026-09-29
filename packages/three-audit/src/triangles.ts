/**
 * Where a triangle budget goes: the total one pass draws, the meshes drawing it, and the
 * geometries behind them.
 */
import type { BatchedMesh, Mesh } from "three";

import {
  type AnyObject3D,
  asObject3D,
  batchedGeometries,
  batchedTriangles,
  isBatched,
  isDrawable,
  isInstanced,
  isMesh,
  materialName,
  meshName,
  pathOf,
  type Skip,
  triangleCount,
  walk,
  withHidden,
} from "./scene.ts";

export type TriangleOptions = { skip?: Skip | undefined };

export type MeshRow = {
  /** `path/to/mesh`: its named ancestors, then its name (or its geometry's name or type). */
  name: string;
  material: string;
  /** Triangles in one copy. A batch's is an average: `geometryCensus` breaks it down. */
  triangles: number;
  instances: number;
  total: number;
  /** Not enumerable: kept out of JSON and `console.table`. */
  readonly mesh: Mesh;
};

export type GeometryRow = {
  /**
   * `geometry.name`, or its type and the start of its uuid. For a geometry in a batch, the batch's
   * `label` for it, or `batch#id`.
   */
  geometry: string;
  /** Copies drawn: every mesh using it, instances counted. */
  uses: number;
  triangles: number;
  total: number;
  /** Its part of the census's total, 0–1. */
  share: number;
  /** With `budget`: whether `share` is over it. */
  overBudget?: boolean;
};

export type CensusOptions = TriangleOptions & {
  /**
   * Names a geometry inside a batch, e.g. from the app's own table of what it added. Default
   * `batch#id`, the batch named by its path.
   */
  label?: ((batch: BatchedMesh, geometryId: number) => string | undefined) | undefined;
  /** Flag rows whose share of the total is over this, 0–1: `0.2` for anything over 20%. */
  budget?: number | undefined;
};

const cost = (mesh: Mesh) => {
  if (isBatched(mesh)) {
    return batchedTriangles(mesh);
  }

  const instances = isInstanced(mesh) ? mesh.count : 1;

  return { instances, triangles: triangleCount(mesh.geometry) * instances };
};

/**
 * Triangles one pass draws: visible meshes, instances counted, no frustum culling. A shadow pass
 * adds roughly as much again for each shadow-casting light.
 */
export const countTriangles = (root: AnyObject3D, options: TriangleOptions = {}) => {
  let total = 0;

  walk(asObject3D(root), { skip: options.skip, visibleOnly: true }, (object) => {
    if (isMesh(object)) {
      total += cost(object).triangles;
    }
  });

  return total;
};

/** Every visible mesh, most triangles drawn first. */
export const listMeshes = (scene: AnyObject3D, options: TriangleOptions = {}): MeshRow[] => {
  const root = asObject3D(scene);
  const rows: MeshRow[] = [];

  walk(root, { skip: options.skip, visibleOnly: true }, (object) => {
    if (!isMesh(object)) {
      return;
    }

    const { instances, triangles } = cost(object);
    const row = {
      name: [...pathOf(object, root), meshName(object)].join("/"),
      material: materialName(object),
      triangles: instances > 0 ? Math.round(triangles / instances) : 0,
      instances,
      total: triangles,
    };

    rows.push(withHidden(row, "mesh", object));
  });

  return rows.sort((a, b) => b.total - a.total);
};

/**
 * Geometries by triangles drawn, hidden meshes included, most first. Name geometries
 * (`geometry.name`) to make this readable. A batch counts each geometry in it separately, by its
 * visible instances: the row a budget is really spent on.
 */
export const geometryCensus = (root: AnyObject3D, options: CensusOptions = {}): GeometryRow[] => {
  const scene = asObject3D(root);
  const rows = new Map<string, GeometryRow>();
  const add = (key: string, triangles: number, uses: number) => {
    const row = rows.get(key) ?? { geometry: key, uses: 0, triangles, total: 0, share: 0 };

    row.uses += uses;
    row.total += triangles * uses;
    rows.set(key, row);
  };

  walk(scene, { skip: options.skip }, (object) => {
    if (!isMesh(object) || !object.geometry.attributes.position) {
      return;
    }

    if (isBatched(object)) {
      const name = [...pathOf(object, scene), meshName(object)].join("/");

      for (const [id, { instances, triangles }] of batchedGeometries(object)) {
        add(options.label?.(object, id) ?? `${name}#${id}`, triangles, instances);
      }

      return;
    }

    const geometry = object.geometry;

    add(
      geometry.name || `${geometry.type}:${geometry.uuid.slice(0, 6)}`,
      triangleCount(geometry),
      isInstanced(object) ? object.count : 1,
    );
  });

  const all = [...rows.values()];
  const sum = all.reduce((total, row) => total + row.total, 0);

  for (const row of all) {
    row.share = sum > 0 ? Math.round((row.total / sum) * 1000) / 1000 : 0;

    if (options.budget !== undefined) {
      row.overBudget = row.total / Math.max(sum, 1) > options.budget;
    }
  }

  return all.sort((a, b) => b.total - a.total);
};

/**
 * Draw calls one main pass makes: one per visible mesh, line or point cloud, or one per material
 * group for a mesh with several materials. Before frustum culling; each shadow-casting light adds
 * one per caster. `recordDrawLedger` counts the real thing.
 */
export const countDraws = (root: AnyObject3D, options: TriangleOptions = {}) => {
  let draws = 0;

  walk(asObject3D(root), { skip: options.skip, visibleOnly: true }, (object) => {
    if (!isDrawable(object)) {
      return;
    }

    const drawable = object as Partial<Mesh>;

    const material = drawable.material;

    if (Array.isArray(material)) {
      const groups = drawable.geometry?.groups ?? [];

      draws += groups.filter(
        (group) => material[group.materialIndex ?? 0]?.visible !== false,
      ).length;
    } else if (material?.visible !== false) {
      draws += 1;
    }
  });

  return draws;
};
