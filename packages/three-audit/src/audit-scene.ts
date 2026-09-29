import { type BadGeometryRow, findBadGeometry } from "./bad-geometry.ts";
import type { AnyObject3D, Skip } from "./scene.ts";
import { countTriangles, listMeshes, type MeshRow } from "./triangles.ts";
import { findZFighting, type ZFightingOptions, type ZFightingRow } from "./z-fighting.ts";

export type AuditSceneOptions = Pick<ZFightingOptions, "gap" | "self" | "tagged"> & {
  skip?: Skip | undefined;
  tagKey?: string;
  /** How many of the costliest meshes to list. */
  top?: number;
};

export type AuditReport = {
  triangles: number;
  zFighting: ZFightingRow[];
  badGeometry: BadGeometryRow[];
  /** The costliest meshes, most triangles first. */
  meshes: MeshRow[];
};

/**
 * Every check at once, JSON-safe: what a test asserts on or a headless browser prints. A clean
 * scene has `zFighting` and `badGeometry` both `[]`.
 */
export const auditScene = (root: AnyObject3D, options: AuditSceneOptions = {}): AuditReport => {
  const { skip, tagKey } = options;

  return {
    triangles: countTriangles(root, { skip }),
    zFighting: findZFighting(root, options),
    badGeometry: findBadGeometry(root, tagKey === undefined ? { skip } : { skip, tagKey }),
    meshes: listMeshes(root, { skip }).slice(0, options.top ?? 10),
  };
};
