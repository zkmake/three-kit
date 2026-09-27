/**
 * Z-fighting found by geometry instead of by eye: pairs of meshes with triangles in (nearly) one
 * plane, facing the same way, overlapping. Those flicker wherever depth precision runs out.
 *
 * Triangles are bucketed by their quantised plane (normal and offset), so only triangles in
 * neighbouring buckets are compared; overlap in the shared plane is a separating-axis test.
 */
import type { Mesh, Object3D } from "three";

import {
  hasTag,
  isBatched,
  isInstanced,
  isMesh,
  materialName,
  meshName,
  type Skip,
  tagOf,
  walk,
  withHidden,
} from "./scene.ts";

export type ZFightingOptions = {
  /**
   * How close two planes count as one, in world units. 0.004 (4 mm at 1 unit = 1 m) is about what
   * depth precision loses with a camera ~50 m out. Scale it with your units.
   */
  gap?: number;
  /** Also compare triangles within one mesh: for merged geometry whose parts share a buffer. */
  self?: boolean;
  /**
   * Only meshes inside a tagged object (`userData[tagKey]`), so a studio's ground and props stay
   * out. Defaults to true when anything under the root is tagged, false otherwise.
   */
  tagged?: boolean;
  tagKey?: string;
  skip?: Skip | undefined;
};

export type ZFightingRow = {
  /** `tag/mesh [material] @ (x, y, z)`, the centre in world space. */
  a: string;
  b: string;
  /** Overlapping triangle pairs between the two. */
  triangles: number;
  /** Not enumerable: kept out of JSON and `console.table`. */
  readonly meshes: readonly [Mesh, Mesh];
};

/** Normals quantised to 1/40: neighbouring buckets are searched, so this only sets bucket size. */
const QUANT = 40;
/** Normals this aligned count as parallel (about 2.6°). */
const PARALLEL = 0.999;

type Part = { mesh: Mesh; tag: string | null; min: number[]; max: number[] };

const round = (value: number) => Math.round(value * 100) / 100;

const labelOf = (part: Part) => {
  const centre = part.min.map((low, axis) => round((low + part.max[axis]!) / 2));
  const tag = part.tag === null ? "" : `${part.tag}/`;

  return `${tag}${meshName(part.mesh)} [${materialName(part.mesh)}] @ (${centre.join(", ")})`;
};

/** Pairs of meshes that z-fight, most overlapping triangles first. `[]` is a pass. */
export const findZFighting = (root: Object3D, options: ZFightingOptions = {}): ZFightingRow[] => {
  const gap = options.gap ?? 0.004;
  const self = options.self ?? false;
  const tagKey = options.tagKey ?? "studioObject";
  const tagged = options.tagged ?? hasTag(root, tagKey, options.skip);

  root.updateWorldMatrix(true, true);

  const parts: Part[] = [];
  // Per triangle: its part, plane (nx, ny, nz, d) and world corners (9 numbers).
  const owner: number[] = [];
  const planes: number[] = [];
  const corners: number[] = [];
  const keys: [number, number, number, number][] = [];
  const buckets = new Map<string, number[]>();
  const keyOf = (x: number, y: number, z: number, d: number) => `${x},${y},${z},${d}`;

  walk(root, { skip: options.skip }, (object) => {
    if (
      !isMesh(object) ||
      isInstanced(object) ||
      isBatched(object) ||
      !object.geometry.attributes.position
    ) {
      return;
    }

    const tag = tagOf(object, tagKey);

    if (tagged && tag === null) {
      return;
    }

    const part = parts.length;
    const { index, attributes } = object.geometry;
    const position = attributes.position!;
    const e = object.matrixWorld.elements;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const count = index?.count ?? position.count;
    const world = [0, 0, 0, 0, 0, 0, 0, 0, 0];

    parts.push({ mesh: object, tag, min, max });

    for (let k = 0; k + 2 < count; k += 3) {
      for (let c = 0; c < 3; c += 1) {
        const v = index?.getX(k + c) ?? k + c;
        const x = position.getX(v);
        const y = position.getY(v);
        const z = position.getZ(v);

        for (let axis = 0; axis < 3; axis += 1) {
          const value = e[axis]! * x + e[axis + 4]! * y + e[axis + 8]! * z + e[axis + 12]!;

          world[c * 3 + axis] = value;
          min[axis] = Math.min(min[axis]!, value);
          max[axis] = Math.max(max[axis]!, value);
        }
      }

      const [ax, ay, az, bx, by, bz, cx, cy, cz] = world as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      const ux = bx - ax;
      const uy = by - ay;
      const uz = bz - az;
      const vx = cx - ax;
      const vy = cy - ay;
      const vz = cz - az;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const length = Math.hypot(nx, ny, nz);

      // Slivers under ~1e-5 m² show nothing.
      if (!(length / 2 >= 1e-5)) {
        continue;
      }

      nx /= length;
      ny /= length;
      nz /= length;

      const d = nx * ax + ny * ay + nz * az;
      const id = owner.length;
      const key: [number, number, number, number] = [
        Math.round(nx * QUANT),
        Math.round(ny * QUANT),
        Math.round(nz * QUANT),
        Math.round(d / gap),
      ];
      const bucket = buckets.get(keyOf(...key));

      owner.push(part);
      planes.push(nx, ny, nz, d);
      corners.push(...world);
      keys.push(key);

      if (bucket) {
        bucket.push(id);
      } else {
        buckets.set(keyOf(...key), [id]);
      }
    }
  });

  // Overlap in s's plane, with a margin so triangles merely sharing an edge don't count.
  const margin = gap / 2;
  const flat = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  const overlaps = (s: number, t: number) => {
    const S = s * 9;
    const T = t * 9;
    let ux = corners[S + 3]! - corners[S]!;
    let uy = corners[S + 4]! - corners[S + 1]!;
    let uz = corners[S + 5]! - corners[S + 2]!;
    const length = Math.hypot(ux, uy, uz) || 1;

    ux /= length;
    uy /= length;
    uz /= length;

    const nx = planes[s * 4]!;
    const ny = planes[s * 4 + 1]!;
    const nz = planes[s * 4 + 2]!;
    const vx = ny * uz - nz * uy;
    const vy = nz * ux - nx * uz;
    const vz = nx * uy - ny * ux;

    // Corners 0–2 are s, 3–5 are t, as (x, y) in the plane.
    for (let i = 0; i < 6; i += 1) {
      const at = i < 3 ? S + i * 3 : T + (i - 3) * 3;
      const px = corners[at]!;
      const py = corners[at + 1]!;
      const pz = corners[at + 2]!;

      flat[i * 2] = px * ux + py * uy + pz * uz;
      flat[i * 2 + 1] = px * vx + py * vy + pz * vz;
    }

    for (let edge = 0; edge < 6; edge += 1) {
      const from = edge;
      const to = edge < 3 ? (edge + 1) % 3 : 3 + ((edge + 1) % 3);
      const ex = flat[to * 2]! - flat[from * 2]!;
      const ey = flat[to * 2 + 1]! - flat[from * 2 + 1]!;
      const edgeLength = Math.hypot(ex, ey) || 1;
      const axisX = -ey / edgeLength;
      const axisY = ex / edgeLength;
      let p0 = Infinity;
      let p1 = -Infinity;
      let q0 = Infinity;
      let q1 = -Infinity;

      for (let i = 0; i < 6; i += 1) {
        const value = flat[i * 2]! * axisX + flat[i * 2 + 1]! * axisY;

        if (i < 3) {
          p0 = Math.min(p0, value);
          p1 = Math.max(p1, value);
        } else {
          q0 = Math.min(q0, value);
          q1 = Math.max(q1, value);
        }
      }

      if (Math.min(p1, q1) - Math.max(p0, q0) < margin) {
        return false;
      }
    }

    return true;
  };

  const pairs = new Map<string, { a: number; b: number; triangles: number }>();

  // Every neighbouring bucket, so near-equal planes that round apart still meet.
  for (let s = 0; s < owner.length; s += 1) {
    const [kx, ky, kz, kd] = keys[s]!;

    for (let i = -1; i <= 1; i += 1) {
      for (let j = -1; j <= 1; j += 1) {
        for (let k = -1; k <= 1; k += 1) {
          for (let l = -1; l <= 1; l += 1) {
            for (const t of buckets.get(keyOf(kx + i, ky + j, kz + k, kd + l)) ?? []) {
              const a = owner[s]!;
              const b = owner[t]!;

              if (
                t <= s ||
                (a === b && !self) ||
                planes[s * 4]! * planes[t * 4]! +
                  planes[s * 4 + 1]! * planes[t * 4 + 1]! +
                  planes[s * 4 + 2]! * planes[t * 4 + 2]! <
                  PARALLEL ||
                Math.abs(planes[s * 4 + 3]! - planes[t * 4 + 3]!) > gap ||
                !overlaps(s, t)
              ) {
                continue;
              }

              const key = a < b ? `${a}:${b}` : `${b}:${a}`;
              const pair = pairs.get(key) ?? { a: Math.min(a, b), b: Math.max(a, b), triangles: 0 };

              pair.triangles += 1;
              pairs.set(key, pair);
            }
          }
        }
      }
    }
  }

  return [...pairs.values()]
    .sort((x, y) => y.triangles - x.triangles)
    .map(({ a, b, triangles }) =>
      withHidden({ a: labelOf(parts[a]!), b: labelOf(parts[b]!), triangles }, "meshes", [
        parts[a]!.mesh,
        parts[b]!.mesh,
      ] as const),
    );
};
