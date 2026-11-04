/**
 * What a mesh draws, in world space, for the checks that compare geometry: each instance of an
 * instanced or batched mesh as a piece of its own, with its exact box and its triangles on demand,
 * and sweeps that find which pieces (and which of their triangles) come near each other.
 */
import type { BatchedMesh, Mesh, Object3D } from "three";

import {
  isBatched,
  isInstanced,
  isMesh,
  materialsOf,
  meshLabel,
  shaderMoves,
  type Skip,
  tagOf,
  walk,
  type WalkOptions,
} from "./scene.ts";

/** A 4 × 4 column-major matrix, as three stores them. */
export type Elements = ArrayLike<number>;

export const multiply = (a: Elements, b: Elements, out: number[]) => {
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      let sum = 0;

      for (let k = 0; k < 4; k += 1) {
        sum += a[k * 4 + row]! * b[column * 4 + k]!;
      }

      out[column * 4 + row] = sum;
    }
  }

  return out;
};

type ViewCamera = {
  updateWorldMatrix: (parents: boolean, children: boolean) => void;
  matrixWorld: unknown;
  matrixWorldInverse: unknown;
  projectionMatrix: { elements: Elements };
};

/** What a camera sees through right now: projection × view, worked out here, not by a render. */
export const viewProjection = (camera: ViewCamera) => {
  camera.updateWorldMatrix(true, false);

  const inverse = camera.matrixWorldInverse as {
    copy: (matrix: unknown) => { invert: () => unknown };
    elements: Elements;
  };

  inverse.copy(camera.matrixWorld).invert();

  return multiply(
    camera.projectionMatrix.elements,
    inverse.elements,
    Array.from({ length: 16 }, () => 0),
  );
};

/** One draw of a mesh's geometry: its range, and where it stands. */
export type Piece = {
  /** The instance's or batch member's id; `null` for a plain mesh. */
  instance: number | null;
  /** World matrix, instance included. The caller may keep it. */
  matrix: number[];
  first: number;
  count: number;
  indexed: boolean;
};

/** Every piece a mesh draws. */
export const eachPiece = (mesh: Mesh, visit: (piece: Piece) => void) => {
  const { index, attributes } = mesh.geometry;
  const position = attributes.position;

  // Fewer than three components: a shader places it, so it has no triangles to measure here.
  if (!position || position.itemSize < 3) {
    return;
  }

  const world = mesh.matrixWorld.elements;

  if (isBatched(mesh)) {
    const batch = mesh as BatchedMesh;
    const instance = Array.from({ length: 16 }, () => 0);
    // `getMatrixAt` fills whatever has three's `fromArray`, so no Matrix4 is needed.
    const target = {
      fromArray(array: ArrayLike<number>, offset = 0) {
        for (let i = 0; i < 16; i += 1) {
          instance[i] = array[offset + i]!;
        }

        return target;
      },
    };

    for (let id = 0; id < batch.maxInstanceCount; id += 1) {
      let range: {
        vertexStart: number;
        vertexCount: number;
        indexStart: number;
        indexCount: number;
      };

      try {
        if (!batch.getVisibleAt(id)) {
          continue;
        }

        range = batch.getGeometryRangeAt(batch.getGeometryIdAt(id)) as typeof range;
        batch.getMatrixAt(id, target as never);
      } catch {
        continue;
      }

      visit({
        instance: id,
        matrix: multiply(
          world,
          instance,
          Array.from({ length: 16 }, () => 0),
        ),
        first: index ? range.indexStart : range.vertexStart,
        count: index ? range.indexCount : range.vertexCount,
        indexed: index !== null,
      });
    }

    return;
  }

  const { start, count } = mesh.geometry.drawRange;
  const elements = index?.count ?? position.count;
  const first = Math.min(start, elements);
  const drawn = Math.min(elements, start + count) - first;
  const indexed = index !== null;

  if (isInstanced(mesh)) {
    const instances = mesh.instanceMatrix.array;

    for (let i = 0; i < mesh.count; i += 1) {
      visit({
        instance: i,
        matrix: multiply(
          world,
          Array.prototype.slice.call(instances, i * 16, i * 16 + 16),
          Array.from({ length: 16 }, () => 0),
        ),
        first,
        count: drawn,
        indexed,
      });
    }

    return;
  }

  visit({ instance: null, matrix: Array.from(world), first, count: drawn, indexed });
};

export type TriangleVisitor = (
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
) => void;

/** Every triangle of one piece, in world space. */
export const eachPieceTriangle = (mesh: Mesh, piece: Piece, visit: TriangleVisitor) => {
  const { index, attributes } = mesh.geometry;
  const position = attributes.position!;
  const { matrix, first, count, indexed } = piece;
  const corner = [0, 0, 0, 0, 0, 0, 0, 0, 0];

  for (let k = first; k + 2 < first + count; k += 3) {
    for (let c = 0; c < 3; c += 1) {
      const v = indexed ? index!.getX(k + c) : k + c;
      const x = position.getX(v);
      const y = position.getY(v);
      const z = position.getZ(v);

      for (let axis = 0; axis < 3; axis += 1) {
        corner[c * 3 + axis] =
          matrix[axis]! * x + matrix[axis + 4]! * y + matrix[axis + 8]! * z + matrix[axis + 12]!;
      }
    }

    visit(...(corner as [number, number, number, number, number, number, number, number, number]));
  }
};

/** Every triangle a mesh draws, in world space: each instance of an instanced or batched mesh. */
export const eachTriangle = (mesh: Mesh, visit: TriangleVisitor) => {
  eachPiece(mesh, (piece) => eachPieceTriangle(mesh, piece, visit));
};

/** A box as [minX, minY, minZ, maxX, maxY, maxZ]. */
export type Box = [number, number, number, number, number, number];

export const emptyBox = (): Box => [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];

export const grow = (box: Box, x: number, y: number, z: number) => {
  box[0] = Math.min(box[0], x);
  box[1] = Math.min(box[1], y);
  box[2] = Math.min(box[2], z);
  box[3] = Math.max(box[3], x);
  box[4] = Math.max(box[4], y);
  box[5] = Math.max(box[5], z);
};

export const boxesNear = (a: Box, b: Box, reach: number) =>
  a[0] - b[3] <= reach &&
  b[0] - a[3] <= reach &&
  a[1] - b[4] <= reach &&
  b[1] - a[4] <= reach &&
  a[2] - b[5] <= reach &&
  b[2] - a[5] <= reach;

/** A mesh a stored position says the place of: no shader moves its vertices. */
export const drawsWhereStored = (mesh: Mesh) =>
  (mesh.geometry as { isInstancedBufferGeometry?: boolean }).isInstancedBufferGeometry !== true &&
  !materialsOf(mesh).some(shaderMoves);

export type DrawnOptions = {
  /**
   * Only meshes inside a tagged object (`userData[tagKey]`), so a studio's ground and props stay
   * out. Defaults to true when anything under the root is tagged, false otherwise.
   */
  tagged?: boolean;
  tagKey?: string;
  skip?: Skip | undefined;
  /** A bake's parts (default), or its merged meshes: see `Bakes`. */
  bakes?: WalkOptions["bakes"];
};

/** The visible meshes a geometry check looks at. */
export const drawnMeshes = (
  root: Object3D,
  options: DrawnOptions & { tagged: boolean; tagKey: string },
) => {
  const meshes: Mesh[] = [];

  walk(
    root,
    { skip: options.skip, visibleOnly: true, bakes: options.bakes ?? "sources" },
    (object) => {
      if (
        isMesh(object) &&
        drawsWhereStored(object) &&
        (!options.tagged || tagOf(object, options.tagKey) !== null)
      ) {
        meshes.push(object);
      }
    },
  );

  return meshes;
};

/** A piece with its box, label and triangles (9 numbers each). */
export type Drawn = Piece & {
  mesh: Mesh;
  label: string;
  box: Box;
  triangles: () => Float64Array;
};

/** Numbers of cached triangles past which the cache starts over: about 240 MB. */
const CACHE_LIMIT = 30_000_000;

/** Pieces of `meshes` with anything to draw. Triangles are read once a sweep asks for them. */
export const drawnPieces = (root: Object3D, meshes: Iterable<Mesh>, tagKey: string): Drawn[] => {
  const pieces: Drawn[] = [];
  let cached = new Set<{ triangles: Float64Array | null }>();
  let total = 0;

  for (const mesh of meshes) {
    const label = meshLabel(mesh, root, tagKey);

    eachPiece(mesh, (piece) => {
      const box = emptyBox();

      eachPieceTriangle(mesh, piece, (ax, ay, az, bx, by, bz, cx, cy, cz) => {
        grow(box, ax, ay, az);
        grow(box, bx, by, bz);
        grow(box, cx, cy, cz);
      });

      if (box[0] > box[3]) {
        return;
      }

      const slot: { triangles: Float64Array | null } = { triangles: null };

      pieces.push({
        ...piece,
        mesh,
        label,
        box,
        triangles: () => {
          if (slot.triangles) {
            return slot.triangles;
          }

          const out = new Float64Array(Math.floor(piece.count / 3) * 9);
          let at = 0;

          eachPieceTriangle(mesh, piece, (ax, ay, az, bx, by, bz, cx, cy, cz) => {
            out[at] = ax;
            out[at + 1] = ay;
            out[at + 2] = az;
            out[at + 3] = bx;
            out[at + 4] = by;
            out[at + 5] = bz;
            out[at + 6] = cx;
            out[at + 7] = cy;
            out[at + 8] = cz;
            at += 9;
          });

          if (total + out.length > CACHE_LIMIT) {
            for (const entry of cached) {
              entry.triangles = null;
            }

            cached = new Set();
            total = 0;
          }

          slot.triangles = out;
          cached.add(slot);
          total += out.length;

          return out;
        },
      });
    });
  }

  return pieces;
};

/** Sweep along the widest axis of the boxes' centres: every pair within `reach` on all axes. */
export const eachNearPair = <Item extends { box: Box }>(
  items: readonly Item[],
  reach: number,
  visit: (a: Item, b: Item) => void,
) => {
  if (items.length < 2) {
    return;
  }

  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];

  for (const { box } of items) {
    for (let axis = 0; axis < 3; axis += 1) {
      const centre = (box[axis]! + box[axis + 3]!) / 2;

      low[axis] = Math.min(low[axis]!, centre);
      high[axis] = Math.max(high[axis]!, centre);
    }
  }

  const spans = [0, 1, 2].map((axis) => high[axis]! - low[axis]!);
  const axis = spans.indexOf(Math.max(...spans));
  const sorted = [...items].sort((a, b) => a.box[axis]! - b.box[axis]!);
  const active: Item[] = [];

  for (const item of sorted) {
    let kept = 0;

    for (const other of active) {
      if (other.box[axis + 3]! + reach >= item.box[axis]!) {
        active[kept] = other;
        kept += 1;

        if (boxesNear(item.box, other.box, reach)) {
          visit(other, item);
        }
      }
    }

    active.length = kept;
    active.push(item);
  }
};

/** A triangle's slot in its 9-numbers-each array, and its box along the sweep's axis. */
const trianglesWithin = (triangles: Float64Array, region: Box, reach: number, axis: number) => {
  const found: { at: number; low: number; high: number }[] = [];

  for (let t = 0; t < triangles.length; t += 9) {
    let inside = true;

    for (let a = 0; a < 3 && inside; a += 1) {
      const u = triangles[t + a]!;
      const v = triangles[t + 3 + a]!;
      const w = triangles[t + 6 + a]!;

      inside =
        Math.max(u, v, w) >= region[a]! - reach && Math.min(u, v, w) <= region[a + 3]! + reach;
    }

    if (inside) {
      const u = triangles[t + axis]!;
      const v = triangles[t + 3 + axis]!;
      const w = triangles[t + 6 + axis]!;

      found.push({ at: t, low: Math.min(u, v, w), high: Math.max(u, v, w) });
    }
  }

  return found;
};

/**
 * Triangles of `a` and `b` whose extents meet along the axis their shared region runs longest, the
 * region being where their boxes (grown by `reach`) overlap. `visit` returns true to stop.
 */
export const eachNearTriangles = (
  a: Drawn,
  b: Drawn,
  reach: number,
  visit: (triangles: Float64Array, at: number, others: Float64Array, otherAt: number) => boolean,
) => {
  const region: Box = [
    Math.max(a.box[0], b.box[0]),
    Math.max(a.box[1], b.box[1]),
    Math.max(a.box[2], b.box[2]),
    Math.min(a.box[3], b.box[3]),
    Math.min(a.box[4], b.box[4]),
    Math.min(a.box[5], b.box[5]),
  ];
  const spans = [0, 1, 2].map((axis) => region[axis + 3]! - region[axis]!);
  const axis = spans.indexOf(Math.max(...spans));
  const left = a.triangles();
  const right = b.triangles();
  const events = [
    ...trianglesWithin(left, region, reach, axis).map((entry) => ({ ...entry, side: 0 })),
    ...trianglesWithin(right, region, reach, axis).map((entry) => ({ ...entry, side: 1 })),
  ].sort((x, y) => x.low - y.low);
  const active: [typeof events, typeof events] = [[], []];

  for (const event of events) {
    const others = active[1 - event.side]!;
    let kept = 0;

    for (const other of others) {
      if (other.high + reach >= event.low) {
        others[kept] = other;
        kept += 1;

        const stop =
          event.side === 0
            ? visit(left, event.at, right, other.at)
            : visit(left, other.at, right, event.at);

        if (stop) {
          return;
        }
      }
    }

    others.length = kept;
    active[event.side]!.push(event);
  }
};
