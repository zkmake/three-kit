import {
  type BadGeometryRow,
  type EmptyMeshRow,
  findBadGeometry,
  findEmptyMeshes,
} from "./bad-geometry.ts";
import { type ColorIssue, findColorIssues } from "./color-issues.ts";
import {
  findFloating,
  findSunk,
  type FloatingRow,
  type GroundOptions,
  type SunkRow,
} from "./grounding.ts";
import { findIntersections, type IntersectionRow } from "./intersections.ts";
import { type AnyObject3D, asObject3D, onlyTag, type Skip } from "./scene.ts";
import { findShadowIssues, type SetupRenderer, type ShadowIssue } from "./shadow-issues.ts";
import { type TextureMemory, textureMemory } from "./texture-memory.ts";
import {
  type TransparentOptions,
  type TransparentOverdraw,
  transparentOverdraw,
} from "./transparent-overdraw.ts";
import { countDraws, countTriangles, listMeshes, type MeshRow } from "./triangles.ts";
import { findUnnamedMeshes, type UnnamedRow } from "./unnamed-meshes.ts";
import { findZFighting, type ZFightingOptions, type ZFightingRow } from "./z-fighting.ts";

export type AuditSceneOptions = Pick<ZFightingOptions, "bakes" | "gap" | "self" | "tagged"> & {
  skip?: Skip | undefined;
  tagKey?: string;
  /** Only the object(s) tagged this (`userData[tagKey]`): one studio object out of a scene. */
  tag?: string | undefined;
  /** How many of the costliest meshes to list. */
  top?: number;
  /** Lets the shadow and colour checks read the renderer's settings. */
  renderer?: SetupRenderer | undefined;
  /** Adds `screens` to `transparent`: how much of this camera's view they cover. */
  camera?: TransparentOptions["camera"];
  /** Also look for what floats or sinks, against this ground. Off by default: clouds float. */
  ground?: GroundOptions["ground"];
  /** Also look for parts crossing each other. Off by default: parts join on purpose. */
  intersections?: boolean;
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
  unnamedMeshes: UnnamedRow[];
  shadowIssues: ShadowIssue[];
  colorIssues: ColorIssue[];
  textures: TextureMemory;
  transparent: TransparentOverdraw;
  /** `null` unless asked for with `intersections`. */
  intersections: IntersectionRow[] | null;
  /** `null` unless asked for with `ground`. */
  floating: FloatingRow[] | null;
  /** `null` unless asked for with `ground`. */
  sunk: SunkRow[] | null;
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
 * scene has `zFighting`, `badGeometry`, `emptyMeshes`, `shadowIssues` and `colorIssues` all `[]`,
 * and `intersections`, `floating` and `sunk` too, when asked for.
 */
export const auditScene = (root: AnyObject3D, options: AuditSceneOptions = {}): AuditReport => {
  const { tagKey, bakes } = options;
  const skip = scopeOf(root, options);
  const keyed = { skip, bakes, ...(tagKey === undefined ? {} : { tagKey }) };
  const scoped = { ...keyed, ...(options.tag === undefined ? {} : { tagged: true }) };
  const { renderer, camera, ground } = options;

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
    unnamedMeshes: findUnnamedMeshes(root, keyed),
    shadowIssues: findShadowIssues(root, { skip, renderer, camera }),
    colorIssues: findColorIssues(root, { skip, renderer }),
    textures: textureMemory(root, { skip }),
    transparent: transparentOverdraw(root, {
      skip,
      camera,
      ...(tagKey === undefined ? {} : { tagKey }),
    }),
    intersections: options.intersections === true ? findIntersections(root, scoped) : null,
    floating: ground === undefined ? null : findFloating(root, { ...scoped, ground }),
    sunk: ground === undefined ? null : findSunk(root, { ...scoped, ground }),
  };
};

export type AuditSummaryOptions = Pick<
  AuditSceneOptions,
  "bakes" | "gap" | "skip" | "tag" | "tagKey"
> & {
  /** Run the z-fighting check, the slow one. Default true; false gives `null` counts. */
  zFighting?: boolean;
  /** Lets the shadow and colour counts include the renderer's settings. */
  renderer?: SetupRenderer | undefined;
  /** The player's camera, for the shadow count: see `findShadowIssues`. */
  camera?: TransparentOptions["camera"];
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
  /** Meshes whose rows every other check can only call by their type. */
  unnamed: number;
  shadowIssues: number;
  colorIssues: number;
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
    unnamed: findUnnamedMeshes(root, keyed).length,
    shadowIssues: findShadowIssues(root, {
      skip,
      renderer: options.renderer,
      camera: options.camera,
    }).length,
    colorIssues: findColorIssues(root, { skip, renderer: options.renderer }).length,
  };
};
