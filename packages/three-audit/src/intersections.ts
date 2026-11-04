/**
 * Parts poking through each other, found by geometry: pairs of meshes whose triangles cross. A
 * crossing counts only when each triangle passes through the other's plane by more than `depth`,
 * so a box resting on a floor doesn't count, and neither do faces in one plane (`findZFighting`
 * has those). Instances and batch members count, each as its own piece.
 *
 * Parts join on purpose (a handle into a door), so nothing here says which crossings are wrong:
 * use `between` to ask about two things that should stay apart, and `allow` for the joins you mean.
 */
import type { Mesh } from "three";

import {
  drawnMeshes,
  type DrawnOptions,
  drawnPieces,
  eachNearPair,
  eachNearTriangles,
} from "./drawn.ts";
import { meshesOf, type Target } from "./measure.ts";
import { type AnyObject3D, asObject3D, hasTag, withHidden } from "./scene.ts";

export type IntersectionOptions = DrawnOptions & {
  /** Only crossings with one side in each of these, tagged or named as `bbox` takes them. */
  between?: readonly [Target, Target] | undefined;
  /**
   * How far a triangle must pass through the other's plane to count, in world units. 0.004 (4 mm
   * at 1 unit = 1 m) by default. Raise it to ignore parts seated a little into each other.
   */
  depth?: number;
  /** Also compare the copies of one instanced or batched mesh with each other. */
  instances?: boolean;
  /** A join that's meant: return true to leave the pair out. */
  allow?: ((a: Mesh, b: Mesh) => boolean) | undefined;
};

export type IntersectionRow = {
  /** `path/to/mesh [material]`: the named ancestors, the mesh, its material. */
  a: string;
  b: string;
  /** Crossing triangle pairs. */
  crossings: number;
  /** Total length of the lines where their surfaces cross, in world units. */
  length: number;
  /** How far the deepest crossing passes through, in world units. */
  depth: number;
  /** Where the deepest crossing is, in world space. */
  at: [number, number, number];
  /** Pairs of pieces folded into this row: copies of the same two meshes. */
  count: number;
  /** Not enumerable: kept out of JSON and `console.table`. The first pair folded in. */
  readonly meshes: readonly [Mesh, Mesh];
};

const round = (value: number, places = 3) => {
  const scale = 10 ** places;
  const rounded = Math.round(value * scale) / scale;

  return rounded === 0 ? 0 : rounded;
};

/** The crossing `crosses` just found. */
const crossing = { length: 0, depth: 0, x: 0, y: 0, z: 0 };
const planeOf = [0, 0, 0];
const heights = [0, 0, 0];
const ends = [0, 0, 0, 0, 0, 0];

/** The plane normal of triangle `t` into `planeOf`; false for a sliver. */
const normalOf = (triangles: Float64Array, t: number) => {
  const ux = triangles[t + 3]! - triangles[t]!;
  const uy = triangles[t + 4]! - triangles[t + 1]!;
  const uz = triangles[t + 5]! - triangles[t + 2]!;
  const vx = triangles[t + 6]! - triangles[t]!;
  const vy = triangles[t + 7]! - triangles[t + 1]!;
  const vz = triangles[t + 8]! - triangles[t + 2]!;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz);

  if (!(length > 1e-12)) {
    return false;
  }

  planeOf[0] = nx / length;
  planeOf[1] = ny / length;
  planeOf[2] = nz / length;

  return true;
};

/** Heights of `t`'s corners over the plane through `on`'s first corner with normal `planeOf`. */
const heightsOver = (triangles: Float64Array, t: number, others: Float64Array, on: number) => {
  for (let c = 0; c < 3; c += 1) {
    const at = t + c * 3;

    heights[c] =
      planeOf[0]! * (triangles[at]! - others[on]!) +
      planeOf[1]! * (triangles[at + 1]! - others[on + 1]!) +
      planeOf[2]! * (triangles[at + 2]! - others[on + 2]!);
  }

  return Math.min(Math.max(heights[0]!, heights[1]!, heights[2]!), -Math.min(...heights));
};

/** Where `t`'s edges cross the plane its `heights` are over: two points, into `ends`. */
const endsOf = (triangles: Float64Array, t: number) => {
  let found = 0;

  for (let c = 0; c < 3 && found < 2; c += 1) {
    const d = (c + 1) % 3;
    const from = heights[c]!;
    const to = heights[d]!;

    if (from > 0 === to > 0) {
      continue;
    }

    const k = from / (from - to);

    for (let axis = 0; axis < 3; axis += 1) {
      const p = triangles[t + c * 3 + axis]!;
      const q = triangles[t + d * 3 + axis]!;

      ends[found * 3 + axis] = p + (q - p) * k;
    }

    found += 1;
  }

  return found === 2;
};

/**
 * Whether two triangles cross, each passing through the other's plane by more than `depth`: the
 * pieces of line each cuts from their planes' meeting, overlapping. Fills `crossing`.
 */
const crosses = (a: Float64Array, s: number, b: Float64Array, t: number, depth: number) => {
  if (!normalOf(b, t)) {
    return false;
  }

  const bx = planeOf[0]!;
  const by = planeOf[1]!;
  const bz = planeOf[2]!;
  const throughB = heightsOver(a, s, b, t);

  if (!(throughB > depth) || !endsOf(a, s)) {
    return false;
  }

  const a0x = ends[0]!;
  const a0y = ends[1]!;
  const a0z = ends[2]!;
  const a1x = ends[3]!;
  const a1y = ends[4]!;
  const a1z = ends[5]!;

  if (!normalOf(a, s)) {
    return false;
  }

  const dx = planeOf[1]! * bz - planeOf[2]! * by;
  const dy = planeOf[2]! * bx - planeOf[0]! * bz;
  const dz = planeOf[0]! * by - planeOf[1]! * bx;
  const line = Math.hypot(dx, dy, dz);
  const throughA = heightsOver(b, t, a, s);

  if (!(line > 1e-9) || !(throughA > depth) || !endsOf(b, t)) {
    return false;
  }

  const along = (x: number, y: number, z: number) => (x * dx + y * dy + z * dz) / line;
  const p0 = along(a0x, a0y, a0z);
  const p1 = along(a1x, a1y, a1z);
  const q0 = along(ends[0]!, ends[1]!, ends[2]!);
  const q1 = along(ends[3]!, ends[4]!, ends[5]!);
  const low = Math.max(Math.min(p0, p1), Math.min(q0, q1));
  const high = Math.min(Math.max(p0, p1), Math.max(q0, q1));

  if (!(high - low > 1e-9)) {
    return false;
  }

  const k = p1 === p0 ? 0 : ((low + high) / 2 - p0) / (p1 - p0);

  crossing.length = high - low;
  crossing.depth = Math.min(throughA, throughB);
  crossing.x = a0x + (a1x - a0x) * k;
  crossing.y = a0y + (a1y - a0y) * k;
  crossing.z = a0z + (a1z - a0z) * k;

  return true;
};

/** Pairs of meshes whose surfaces cross, longest crossing first. `[]` is a pass. */
export const findIntersections = (
  scene: AnyObject3D,
  options: IntersectionOptions = {},
): IntersectionRow[] => {
  const root = asObject3D(scene);
  const tagKey = options.tagKey ?? "studioObject";
  const depth = options.depth ?? 0.004;
  const { between, allow } = options;

  root.updateWorldMatrix(true, true);

  const sideOf = new Map<Mesh, number>();
  const visible = drawnMeshes(root, {
    ...options,
    tagged: between ? false : (options.tagged ?? hasTag(root, tagKey, options.skip)),
    tagKey,
  });

  if (between) {
    const sideB = meshesOf(root, between[1], { tagKey, bakes: options.bakes }, "between b");
    const sideA = meshesOf(root, between[0], { tagKey, bakes: options.bakes }, "between a");

    for (const mesh of sideB) {
      sideOf.set(mesh, 1);
    }

    for (const mesh of sideA) {
      if (!sideB.has(mesh)) {
        sideOf.set(mesh, 0);
      }
    }
  }

  const meshes = between ? visible.filter((mesh) => sideOf.has(mesh)) : visible;
  const pieces = drawnPieces(root, meshes, tagKey);
  const rows = new Map<string, IntersectionRow>();

  eachNearPair(pieces, depth, (first, second) => {
    const same = first.mesh === second.mesh;

    if (
      (same && !(options.instances === true && first.instance !== second.instance)) ||
      (between && sideOf.get(first.mesh) === sideOf.get(second.mesh)) ||
      allow?.(first.mesh, second.mesh) === true
    ) {
      return;
    }

    const [left, right] = first.label <= second.label ? [first, second] : [second, first];
    let crossings = 0;
    let length = 0;
    let deepest = 0;
    let at: [number, number, number] = [0, 0, 0];

    eachNearTriangles(left, right, 0, (triangles, s, others, t) => {
      if (crosses(triangles, s, others, t, depth)) {
        crossings += 1;
        length += crossing.length;

        if (crossing.depth > deepest) {
          deepest = crossing.depth;
          at = [crossing.x, crossing.y, crossing.z];
        }
      }

      return false;
    });

    if (crossings === 0) {
      return;
    }

    const key = JSON.stringify([left.label, right.label]);
    const known = rows.get(key);

    if (known) {
      known.crossings += crossings;
      known.length += length;
      known.count += 1;

      if (deepest > known.depth) {
        known.depth = deepest;
        known.at = at;
      }

      return;
    }

    rows.set(
      key,
      withHidden(
        { a: left.label, b: right.label, crossings, length, depth: deepest, at, count: 1 },
        "meshes",
        [left.mesh, right.mesh] as const,
      ),
    );
  });

  return [...rows.values()]
    .map((row) => {
      row.length = round(row.length);
      row.depth = round(row.depth);
      row.at = row.at.map((value) => round(value, 2)) as [number, number, number];

      return row;
    })
    .sort((x, y) => y.length - x.length);
};
