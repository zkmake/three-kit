/**
 * Whether things stand on the ground. `findFloating`: groups of touching parts that nothing joins
 * to the ground, the water tower hanging a metre over its roof. `findSunk`: parts that go further
 * into the ground than they should, or are under it altogether.
 *
 * Touching is measured between triangles' bounding boxes, as `measureClearance` measures: exact
 * for faces square to the axes, generous for sloped ones. So a part is only ever called floating
 * when it truly clears what's under it; a sloped neighbour can hide one that does.
 */
import type { Mesh, Object3D } from "three";

import {
  type Box,
  drawnMeshes,
  type DrawnOptions,
  type Drawn,
  drawnPieces,
  eachNearPair,
  eachNearTriangles,
} from "./drawn.ts";
import { meshesOf, type Target } from "./measure.ts";
import { type AnyObject3D, asObject3D, hasTag, withHidden } from "./scene.ts";

export type GroundOptions = DrawnOptions & {
  /**
   * What's underfoot: a height (y, default 0), or a target (tagged or named, as `bbox` takes it)
   * for a terrain or anything uneven. A target stays out of the rows itself.
   */
  ground?: number | Target | undefined;
};

export type FloatingOptions = GroundOptions & {
  /** How close counts as touching, in world units. Default 0.02 (2 cm at 1 unit = 1 m). */
  gap?: number;
};

export type FloatingRow = {
  /** The lowest part of the group, `path/to/mesh [material]`: what should reach down. */
  mesh: string;
  /** Pieces in the group, touching each other. */
  parts: number;
  /** How far its lowest point clears the ground; `null` when no ground lies under it. */
  height: number | null;
  /**
   * What's directly under it, when anything is: `path/to/mesh [material]`. A tower over a roof is
   * short of the roof, not the ground.
   */
  over: string | null;
  /** How far it clears that, in world units; `null` when nothing is under it. */
  clearance: number | null;
  /** The centre of the group's lowest part, in world space. */
  at: [number, number, number];
  /** Identical groups folded into this row: copies of one prop. */
  count: number;
  /** Not enumerable: kept out of JSON and `console.table`. Every mesh in the first group. */
  readonly meshes: readonly Mesh[];
};

export type SunkOptions = GroundOptions & {
  /** How far under the ground a part may go, in world units. Default 0.02. */
  depth?: number;
};

export type SunkRow = {
  /** `path/to/mesh [material]`. */
  mesh: string;
  /** How far it goes under the ground, in world units. */
  depth: number;
  /** How much of its height is under the ground, 0 to 1. */
  share: number;
  /** Wholly under the ground: its triangles draw nothing anyone sees. */
  buried: boolean;
  /** Its centre, in world space. */
  at: [number, number, number];
  /** Pieces folded into this row: copies of one mesh. `depth` and `share` are the worst one's. */
  count: number;
  /** Not enumerable: kept out of JSON and `console.table`. */
  readonly object: Mesh;
};

const round = (value: number, places = 3) => {
  const scale = 10 ** places;
  const rounded = Math.round(value * scale) / scale;

  return rounded === 0 ? 0 : rounded;
};

const centreOf = (box: Box): [number, number, number] => [
  round((box[0] + box[3]) / 2, 2),
  round((box[1] + box[4]) / 2, 2),
  round((box[2] + box[5]) / 2, 2),
];

/** The ground's surface height under a point: a height, or the highest triangle above (x, z). */
const surfaceOf = (ground: readonly Drawn[] | number) => {
  if (typeof ground === "number") {
    return () => ground;
  }

  const triangles = ground.map((piece) => piece.triangles());

  return (x: number, z: number) => {
    let highest: number | null = null;

    for (const list of triangles) {
      for (let t = 0; t < list.length; t += 9) {
        const ax = list[t]!;
        const az = list[t + 2]!;
        const ux = list[t + 3]! - ax;
        const uz = list[t + 5]! - az;
        const vx = list[t + 6]! - ax;
        const vz = list[t + 8]! - az;
        const area = ux * vz - uz * vx;

        if (Math.abs(area) < 1e-12) {
          continue;
        }

        const u = ((x - ax) * vz - (z - az) * vx) / area;
        const v = (ux * (z - az) - uz * (x - ax)) / area;

        if (u < 0 || v < 0 || u + v > 1) {
          continue;
        }

        const ay = list[t + 1]!;
        const y = ay + u * (list[t + 4]! - ay) + v * (list[t + 7]! - ay);

        if (highest === null || y > highest) {
          highest = y;
        }
      }
    }

    return highest;
  };
};

/** What the checks look at, and the ground apart from it. */
const piecesOf = (scene: AnyObject3D, options: GroundOptions) => {
  const root = asObject3D(scene);
  const tagKey = options.tagKey ?? "studioObject";
  const { ground = 0 } = options;

  root.updateWorldMatrix(true, true);

  const groundMeshes =
    typeof ground === "number"
      ? new Set<Mesh>()
      : meshesOf(root, ground, { tagKey, bakes: options.bakes }, "ground");
  const meshes = drawnMeshes(root as Object3D, {
    ...options,
    tagged: options.tagged ?? hasTag(root, tagKey, options.skip),
    tagKey,
  }).filter((mesh) => !groundMeshes.has(mesh));

  return {
    pieces: drawnPieces(root, meshes, tagKey),
    ground: typeof ground === "number" ? ground : drawnPieces(root, groundMeshes, tagKey),
  };
};

/** The nearest surface under a piece's footprint: which piece, and how far down. */
const nearestUnder = (piece: Drawn, others: readonly Drawn[]) => {
  const { box } = piece;
  let best: Drawn | null = null;
  let top = -Infinity;

  for (const other of others) {
    if (
      other === piece ||
      other.box[1] > box[1] ||
      other.box[0] > box[3] ||
      other.box[3] < box[0] ||
      other.box[2] > box[5] ||
      other.box[5] < box[2]
    ) {
      continue;
    }

    const triangles = other.triangles();

    for (let t = 0; t < triangles.length; t += 9) {
      const high = Math.max(triangles[t + 1]!, triangles[t + 4]!, triangles[t + 7]!);

      if (
        high > top &&
        high <= box[1] &&
        Math.min(triangles[t]!, triangles[t + 3]!, triangles[t + 6]!) <= box[3] &&
        Math.max(triangles[t]!, triangles[t + 3]!, triangles[t + 6]!) >= box[0] &&
        Math.min(triangles[t + 2]!, triangles[t + 5]!, triangles[t + 8]!) <= box[5] &&
        Math.max(triangles[t + 2]!, triangles[t + 5]!, triangles[t + 8]!) >= box[2]
      ) {
        top = high;
        best = other;
      }
    }
  }

  return best ? { label: best.label, clearance: round(box[1] - top) } : null;
};

/** Two pieces touch when any of their triangles' boxes come within `gap`. */
const touching = (a: Drawn, b: Drawn, gap: number) => {
  let touches = false;

  eachNearTriangles(a, b, gap, (left, s, right, t) => {
    for (let axis = 0; axis < 3; axis += 1) {
      const lowA = Math.min(left[s + axis]!, left[s + 3 + axis]!, left[s + 6 + axis]!);
      const highA = Math.max(left[s + axis]!, left[s + 3 + axis]!, left[s + 6 + axis]!);
      const lowB = Math.min(right[t + axis]!, right[t + 3 + axis]!, right[t + 6 + axis]!);
      const highB = Math.max(right[t + axis]!, right[t + 3 + axis]!, right[t + 6 + axis]!);

      if (lowA - highB > gap || lowB - highA > gap) {
        return false;
      }
    }

    touches = true;

    return true;
  });

  return touches;
};

/**
 * Groups of touching parts with nothing joining them to the ground, furthest off it first. Things
 * that fly on purpose (birds, clouds) belong in `skip`. `[]` is a pass.
 */
export const findFloating = (scene: AnyObject3D, options: FloatingOptions = {}): FloatingRow[] => {
  const gap = options.gap ?? 0.02;
  const { pieces, ground } = piecesOf(scene, options);
  const onGround = typeof ground === "number" ? [] : ground;
  const all = [...pieces, ...onGround];
  const groundRoot = all.length;
  const parent = Array.from({ length: all.length + 1 }, (_, i) => i);
  const find = (i: number) => {
    let at = i;

    while (parent[at] !== at) {
      parent[at] = parent[parent[at]!]!;
      at = parent[at]!;
    }

    return at;
  };
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  const ids = new Map(all.map((piece, i) => [piece, i]));

  if (typeof ground === "number") {
    pieces.forEach((piece, i) => {
      if (piece.box[1] <= ground + gap) {
        union(i, groundRoot);
      }
    });
  } else {
    for (let i = pieces.length; i < all.length; i += 1) {
      union(i, groundRoot);
    }
  }

  eachNearPair(all, gap, (a, b) => {
    const i = ids.get(a)!;
    const j = ids.get(b)!;

    if (find(i) !== find(j) && touching(a, b, gap)) {
      union(i, j);
    }
  });

  const groups = new Map<number, Drawn[]>();

  pieces.forEach((piece, i) => {
    const group = find(i);

    if (group !== find(groundRoot)) {
      groups.set(group, [...(groups.get(group) ?? []), piece]);
    }
  });

  const surface = surfaceOf(ground);
  const rows = new Map<string, FloatingRow>();

  for (const group of groups.values()) {
    const lowest = group.reduce((a, b) => (b.box[1] < a.box[1] ? b : a));
    const under = surface((lowest.box[0] + lowest.box[3]) / 2, (lowest.box[2] + lowest.box[5]) / 2);
    const key = JSON.stringify([lowest.label, group.length]);
    const known = rows.get(key);

    if (known) {
      known.count += 1;
      continue;
    }

    const below = nearestUnder(lowest, all);

    rows.set(
      key,
      withHidden(
        {
          mesh: lowest.label,
          parts: group.length,
          height: under === null ? null : round(lowest.box[1] - under),
          over: below?.label ?? null,
          clearance: below?.clearance ?? null,
          at: centreOf(lowest.box),
          count: 1,
        },
        "meshes",
        [...new Set(group.map((piece) => piece.mesh))],
      ),
    );
  }

  return [...rows.values()].sort((a, b) => (b.height ?? Infinity) - (a.height ?? Infinity));
};

/**
 * Parts further under the ground than `depth`, the wholly buried first, then by how much of each
 * is under. A floor that's a solid slab is under its own top: pass it as `ground`. `[]` is a pass.
 */
export const findSunk = (scene: AnyObject3D, options: SunkOptions = {}): SunkRow[] => {
  const limit = options.depth ?? 0.02;
  const { pieces, ground } = piecesOf(scene, options);
  const surface = surfaceOf(ground);
  const rows = new Map<string, SunkRow>();

  for (const piece of pieces) {
    const { box, label, mesh } = piece;
    const under = surface((box[0] + box[3]) / 2, (box[2] + box[5]) / 2);

    if (under === null || !(under - box[1] > limit)) {
      continue;
    }

    const height = box[4] - box[1];
    const depth = round(under - box[1]);
    const share = round(height > 0 ? Math.min(1, (under - box[1]) / height) : 1, 2);
    const buried = box[4] <= under;
    const known = rows.get(label);

    if (known) {
      known.count += 1;

      if (share > known.share || depth > known.depth) {
        known.depth = Math.max(known.depth, depth);
        known.share = Math.max(known.share, share);
        known.buried ||= buried;
        known.at = centreOf(box);
      }

      continue;
    }

    rows.set(
      label,
      withHidden(
        { mesh: label, depth, share, buried, at: centreOf(box), count: 1 },
        "object",
        mesh,
      ),
    );
  }

  return [...rows.values()].sort(
    (a, b) => Number(b.buried) - Number(a.buried) || b.share - a.share || b.depth - a.depth,
  );
};
