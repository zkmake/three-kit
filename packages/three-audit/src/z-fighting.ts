/**
 * Z-fighting found by geometry instead of by eye: pairs of meshes with triangles in (nearly) one
 * plane, facing the same way, overlapping. Those flicker wherever depth precision runs out.
 *
 * Triangles are bucketed by their quantised plane (normal and offset), so only triangles in
 * neighbouring buckets are compared. A pair counts only when each triangle's corners lie within
 * `gap` of the other's plane, measured at the triangles: the offsets are measured from the world
 * origin, and far from it two faces a degree or two apart can share one while metres apart where
 * they stand. Overlap in the shared plane is a separating-axis test, then clipped for its area.
 *
 * Left out, as they can't fight: hidden objects, instanced and batched meshes (and geometry a
 * shader positions, `InstancedBufferGeometry`), pairs where neither side writes depth or one
 * doesn't test it, and pairs where either material has a polygon offset (the usual decal fix).
 */
import type { Material, Mesh } from "three";

import {
  type AnyObject3D,
  asObject3D,
  hasTag,
  isBatched,
  isInstanced,
  isMesh,
  meshLabel,
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
  /** `path/to/mesh [material] @ (x, y, z)`: named ancestors, and the centre in world space. */
  a: string;
  b: string;
  /** Overlapping triangle pairs between the two. */
  triangles: number;
  /**
   * The planes they share, most overlap first: `z = -3.000, facing +z` when axis-aligned, else
   * `(nx, ny, nz) · p = d`. Both faces point along the normal: opposite-facing faces never pair.
   */
  planes: string[];
  /** Where they overlap: the area in world units², and its centre in world space. */
  overlap: { area: number; centre: [number, number, number] };
  /** Identical pairs (same labels, triangles and planes) folded into this row. */
  count: number;
  /** Not enumerable: kept out of JSON and `console.table`. The first pair folded in. */
  readonly meshes: readonly [Mesh, Mesh];
  /** Not enumerable: every pair folded in. */
  readonly pairs: readonly (readonly [Mesh, Mesh])[];
};

/** Normals quantised to 1/40: neighbouring buckets are searched, so this only sets bucket size. */
const QUANT = 40;
/** Normals this aligned count as parallel (about 2.6°). */
const PARALLEL = 0.999;

type Part = {
  mesh: Mesh;
  label: string;
  min: number[];
  max: number[];
  /** Some material writes depth / tests it / offsets it. */
  writes: boolean;
  tests: boolean;
  offset: boolean;
};

const round = (value: number, places = 2) => {
  const scale = 10 ** places;
  const rounded = Math.round(value * scale) / scale;

  return rounded === 0 ? 0 : rounded;
};

const labelOf = (part: Part) => {
  const centre = part.min.map((low, axis) => round((low + part.max[axis]!) / 2));

  return `${part.label} @ (${centre.join(", ")})`;
};

const fixed = (value: number) => round(value, 3).toFixed(3);

/** `z = -3.000, facing +z` for an axis-aligned plane, `(nx, ny, nz) · p = d` for any other. */
const planeLabel = (nx: number, ny: number, nz: number, d: number) => {
  for (const [axis, value] of [
    ["x", nx],
    ["y", ny],
    ["z", nz],
  ] as const) {
    if (Math.abs(value) > 0.9999) {
      return `${axis} = ${fixed(d / value)}, facing ${value > 0 ? "+" : "-"}${axis}`;
    }
  }

  return `(${fixed(nx)}, ${fixed(ny)}, ${fixed(nz)}) · p = ${fixed(d)}`;
};

const materialsOf = (mesh: Mesh) =>
  (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(
    (material): material is Material => material !== undefined && material !== null,
  );

/** Whether two parts can fight: one writes depth the other tests, and neither is offset. */
const canFight = (a: Part, b: Part) =>
  !a.offset && !b.offset && ((a.writes && b.tests) || (b.writes && a.tests));

/** Pairs of meshes that z-fight, most overlapping triangles first. `[]` is a pass. */
export const findZFighting = (
  scene: AnyObject3D,
  options: ZFightingOptions = {},
): ZFightingRow[] => {
  const root = asObject3D(scene);
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

  walk(root, { skip: options.skip, visibleOnly: true }, (object) => {
    if (
      !isMesh(object) ||
      isInstanced(object) ||
      isBatched(object) ||
      (object.geometry as { isInstancedBufferGeometry?: boolean }).isInstancedBufferGeometry ===
        true ||
      !object.geometry.attributes.position
    ) {
      return;
    }

    if (tagged && tagOf(object, tagKey) === null) {
      return;
    }

    const materials = materialsOf(object).filter((material) => material.visible !== false);

    if (materials.length === 0) {
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

    parts.push({
      mesh: object,
      label: meshLabel(object, root, tagKey),
      min,
      max,
      writes: materials.some((material) => material.depthWrite !== false),
      tests: materials.some((material) => material.depthTest !== false),
      offset: materials.some(
        (material) =>
          material.polygonOffset === true &&
          (material.polygonOffsetFactor !== 0 || material.polygonOffsetUnits !== 0),
      ),
    });

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
  // s's plane axes from the last `overlaps`: u, then v.
  const frame = [0, 0, 0, 0, 0, 0];

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

    frame[0] = ux;
    frame[1] = uy;
    frame[2] = uz;
    frame[3] = vx;
    frame[4] = vy;
    frame[5] = vz;

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

  /**
   * The overlap `overlaps` just found, as area and centroid in s's plane: t's triangle clipped to
   * s's (Sutherland–Hodgman), then the shoelace formula.
   */
  const clipped = () => {
    const turn =
      (flat[2]! - flat[0]!) * (flat[5]! - flat[1]!) - (flat[4]! - flat[0]!) * (flat[3]! - flat[1]!);
    // s's corners counter-clockwise.
    const order = turn >= 0 ? [0, 1, 2] : [0, 2, 1];
    let polygon = flat.slice(6, 12);

    for (let edge = 0; edge < 3 && polygon.length >= 6; edge += 1) {
      const ax = flat[order[edge]! * 2]!;
      const ay = flat[order[edge]! * 2 + 1]!;
      const ex = flat[order[(edge + 1) % 3]! * 2]! - ax;
      const ey = flat[order[(edge + 1) % 3]! * 2 + 1]! - ay;
      const next: number[] = [];
      const n = polygon.length / 2;

      for (let i = 0; i < n; i += 1) {
        const px = polygon[i * 2]!;
        const py = polygon[i * 2 + 1]!;
        const qx = polygon[((i + 1) % n) * 2]!;
        const qy = polygon[((i + 1) % n) * 2 + 1]!;
        const dp = ex * (py - ay) - ey * (px - ax);
        const dq = ex * (qy - ay) - ey * (qx - ax);

        if (dp >= 0) {
          next.push(px, py);
        }

        if (dp >= 0 !== dq >= 0) {
          const k = dp / (dp - dq);

          next.push(px + (qx - px) * k, py + (qy - py) * k);
        }
      }

      polygon = next;
    }

    let twice = 0;
    let cx = 0;
    let cy = 0;
    const n = polygon.length / 2;

    for (let i = 0; i < n; i += 1) {
      const x0 = polygon[i * 2]!;
      const y0 = polygon[i * 2 + 1]!;
      const x1 = polygon[((i + 1) % n) * 2]!;
      const y1 = polygon[((i + 1) % n) * 2 + 1]!;
      const cross = x0 * y1 - x1 * y0;

      twice += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }

    return Math.abs(twice) < 1e-12
      ? { area: 0, x: 0, y: 0 }
      : { area: Math.abs(twice) / 2, x: cx / (3 * twice), y: cy / (3 * twice) };
  };

  // Every corner of t within `gap` of s's plane, measured where t stands.
  const onPlane = (s: number, t: number) => {
    const nx = planes[s * 4]!;
    const ny = planes[s * 4 + 1]!;
    const nz = planes[s * 4 + 2]!;
    const d = planes[s * 4 + 3]!;

    for (let c = 0; c < 3; c += 1) {
      const at = t * 9 + c * 3;

      if (Math.abs(nx * corners[at]! + ny * corners[at + 1]! + nz * corners[at + 2]! - d) > gap) {
        return false;
      }
    }

    return true;
  };

  type Pair = {
    a: number;
    b: number;
    triangles: number;
    area: number;
    /** Area-weighted sums of the overlap's centre. */
    centre: [number, number, number];
    planes: Map<string, number>;
  };

  const pairs = new Map<string, Pair>();

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
                !canFight(parts[a]!, parts[b]!) ||
                planes[s * 4]! * planes[t * 4]! +
                  planes[s * 4 + 1]! * planes[t * 4 + 1]! +
                  planes[s * 4 + 2]! * planes[t * 4 + 2]! <
                  PARALLEL ||
                !onPlane(s, t) ||
                !onPlane(t, s) ||
                !overlaps(s, t)
              ) {
                continue;
              }

              const key = a < b ? `${a}:${b}` : `${b}:${a}`;
              const pair = pairs.get(key) ?? {
                a: Math.min(a, b),
                b: Math.max(a, b),
                triangles: 0,
                area: 0,
                centre: [0, 0, 0],
                planes: new Map<string, number>(),
              };
              const nx = planes[s * 4]!;
              const ny = planes[s * 4 + 1]!;
              const nz = planes[s * 4 + 2]!;
              const d = planes[s * 4 + 3]!;
              const { area, x, y } = clipped();
              const plane = planeLabel(nx, ny, nz, d);

              pair.triangles += 1;
              pair.area += area;
              pair.centre[0] += area * (x * frame[0]! + y * frame[3]! + d * nx);
              pair.centre[1] += area * (x * frame[1]! + y * frame[4]! + d * ny);
              pair.centre[2] += area * (x * frame[2]! + y * frame[5]! + d * nz);
              pair.planes.set(plane, (pair.planes.get(plane) ?? 0) + area);
              pairs.set(key, pair);
            }
          }
        }
      }
    }
  }

  // Fold identical pairs (pooled copies of one prop, all at one spot) into one row each.
  const rows = new Map<string, ZFightingRow & { pairs: (readonly [Mesh, Mesh])[] }>();

  for (const pair of [...pairs.values()].sort((x, y) => y.triangles - x.triangles)) {
    const meshes = [parts[pair.a]!.mesh, parts[pair.b]!.mesh] as const;
    const a = labelOf(parts[pair.a]!);
    const b = labelOf(parts[pair.b]!);
    const planeLabels = [...pair.planes.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([plane]) => plane);
    const key = JSON.stringify([a, b, pair.triangles, planeLabels]);
    const folded = rows.get(key);

    if (folded) {
      folded.count += 1;
      folded.pairs.push(meshes);
      continue;
    }

    const weight = pair.area > 0 ? pair.area : 1;
    const row = withHidden(
      withHidden(
        {
          a,
          b,
          triangles: pair.triangles,
          planes: planeLabels,
          overlap: {
            area: round(pair.area, 4),
            centre: pair.centre.map((sum) => round(sum / weight)) as [number, number, number],
          },
          count: 1,
        },
        "meshes",
        meshes,
      ),
      "pairs",
      [meshes],
    );

    rows.set(key, row);
  }

  return [...rows.values()];
};
