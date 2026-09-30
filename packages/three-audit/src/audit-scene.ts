import {
  type BadGeometryRow,
  type EmptyMeshRow,
  findBadGeometry,
  findEmptyMeshes,
} from "./bad-geometry.ts";
import { type AnyObject3D, asObject3D, onlyTag, type Skip } from "./scene.ts";
import { countDraws, countTriangles, listMeshes, type MeshRow } from "./triangles.ts";
import { findZFighting, type ZFightingOptions, type ZFightingRow } from "./z-fighting.ts";

export type AuditSceneOptions = Pick<ZFightingOptions, "bakes" | "gap" | "self" | "tagged"> & {
  skip?: Skip | undefined;
  tagKey?: string;
  /** Only the object(s) tagged this (`userData[tagKey]`): one studio object out of a scene. */
  tag?: string | undefined;
  /** How many of the costliest meshes to list. */
  top?: number;
};

export type AuditReport = {
  triangles: number;
  /** Draw calls one main pass makes, before culling and shadows: see `countDraws`. */
  draws: number;
  zFighting: ZFightingRow[];
  badGeometry: BadGeometryRow[];
  emptyMeshes: EmptyMeshRow[];
  /** The costliest meshes, most triangles first. */
  meshes: MeshRow[];
};

/** The skip every check runs with: the caller's, narrowed to `tag` when given. */
const scopeOf = (
  root: AnyObject3D,
  options: { skip?: Skip | undefined; tag?: string | undefined; tagKey?: string },
) =>
  options.tag === undefined
    ? options.skip
    : onlyTag(asObject3D(root), options.tag, options.tagKey ?? "studioObject", options.skip);

/**
 * Every check at once, JSON-safe: what a test asserts on or a headless browser prints. A clean
 * scene has `zFighting`, `badGeometry` and `emptyMeshes` all `[]`.
 */
export const auditScene = (root: AnyObject3D, options: AuditSceneOptions = {}): AuditReport => {
  const { tagKey, bakes } = options;
  const skip = scopeOf(root, options);
  const keyed = { skip, bakes, ...(tagKey === undefined ? {} : { tagKey }) };

  return {
    triangles: countTriangles(root, { skip }),
    draws: countDraws(root, { skip }),
    zFighting: findZFighting(root, {
      ...options,
      skip,
      ...(options.tag === undefined ? {} : { tagged: true }),
    }),
    badGeometry: findBadGeometry(root, keyed),
    emptyMeshes: findEmptyMeshes(root, keyed),
    meshes: listMeshes(root, { skip }).slice(0, options.top ?? 10),
  };
};

export type AuditSummaryOptions = Pick<
  AuditSceneOptions,
  "bakes" | "gap" | "skip" | "tag" | "tagKey"
> & {
  /** Run the z-fighting check, the slow one. Default true; false gives `null` counts. */
  zFighting?: boolean;
};

export type AuditSummary = {
  triangles: number;
  draws: number;
  meshes: number;
  /** Pairs of meshes that z-fight, identical pairs counted each. */
  zFighting: number | null;
  /** Meshes that z-fight with themselves: merged geometry whose parts overlap. */
  selfZFighting: number | null;
  badGeometry: number;
  emptyMeshes: number;
};

/**
 * Every check as one count each: the single call to run after every edit. `0` everywhere (and
 * `triangles`, `draws` where you expect them) is a pass. Use `auditScene` to see what failed.
 */
export const summarizeScene = (
  root: AnyObject3D,
  options: AuditSummaryOptions = {},
): AuditSummary => {
  const { tagKey, bakes } = options;
  const skip = scopeOf(root, options);
  const keyed = { skip, bakes, ...(tagKey === undefined ? {} : { tagKey }) };
  let zFighting: number | null = null;
  let selfZFighting: number | null = null;

  if (options.zFighting !== false) {
    zFighting = 0;
    selfZFighting = 0;

    for (const row of findZFighting(root, {
      ...(options.gap === undefined ? {} : { gap: options.gap }),
      ...(tagKey === undefined ? {} : { tagKey }),
      ...(options.tag === undefined ? {} : { tagged: true }),
      skip,
      bakes,
      self: true,
    })) {
      if (row.meshes[0] === row.meshes[1]) {
        selfZFighting += row.count;
      } else {
        zFighting += row.count;
      }
    }
  }

  return {
    triangles: countTriangles(root, { skip }),
    draws: countDraws(root, { skip }),
    meshes: listMeshes(root, { skip }).length,
    zFighting,
    selfZFighting,
    badGeometry: findBadGeometry(root, keyed).length,
    emptyMeshes: findEmptyMeshes(root, keyed).length,
  };
};
