/**
 * Where a triangle budget goes: the total one pass draws, the meshes drawing it, and the
 * geometries behind them.
 */
import type { Mesh } from "three";

import {
  type AnyObject3D,
  asObject3D,
  batchedTriangles,
  isBatched,
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
  /** Triangles in one copy (a batch's average). */
  triangles: number;
  instances: number;
  total: number;
  /** Not enumerable: kept out of JSON and `console.table`. */
  readonly mesh: Mesh;
};

export type GeometryRow = {
  /** `geometry.name`, or its type and the start of its uuid. */
  geometry: string;
  /** Copies drawn: every mesh using it, instances counted. */
  uses: number;
  triangles: number;
  total: number;
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
 * (`geometry.name`) to make this readable. Batches are left out: their shared buffer is not one
 * geometry; `listMeshes` counts them.
 */
export const geometryCensus = (root: AnyObject3D, options: TriangleOptions = {}): GeometryRow[] => {
  const rows = new Map<string, GeometryRow>();

  walk(asObject3D(root), { skip: options.skip }, (object) => {
    if (!isMesh(object) || isBatched(object) || !object.geometry.attributes.position) {
      return;
    }

    const geometry = object.geometry;
    const key = geometry.name || `${geometry.type}:${geometry.uuid.slice(0, 6)}`;
    const triangles = triangleCount(geometry);
    const uses = isInstanced(object) ? object.count : 1;
    const row = rows.get(key) ?? { geometry: key, uses: 0, triangles, total: 0 };

    row.uses += uses;
    row.total += triangles * uses;
    rows.set(key, row);
  });

  return [...rows.values()].sort((a, b) => b.total - a.total);
};
