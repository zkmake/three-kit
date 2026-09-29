/**
 * Measuring a layout: an object's world envelope, and the gap between two objects. The questions
 * a scene raises before anything renders wrong: does the train fit under the crossbar, does the
 * lid clear the hinge.
 *
 * Measured from the vertices as drawn (instances and batches included), not from bounding boxes
 * transformed after the fact, which grow with every rotation.
 */
import type { BatchedMesh, Mesh, Object3D } from "three";

import {
  type AnyObject3D,
  asObject3D,
  isBatched,
  isInstanced,
  isMesh,
  meshLabel,
  walk,
} from "./scene.ts";

export type MeasureOptions = {
  /** `userData` key a string target is looked up by. Default `studioObject`. */
  tagKey?: string;
};

/** What to measure: an object, or a tag (`userData[tagKey]`), or failing that an object name. */
export type Target = string | AnyObject3D;

export type Bounds = {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  centre: [number, number, number];
};

export type Clearance = {
  /**
   * The smallest gap between the two, in world units. Measured between triangles' bounding boxes:
   * exact for faces square to the axes, a slight underestimate for sloped ones. 0 when they touch
   * or intersect.
   */
  gap: number;
  /** The axis the gap is measured along, when it's straight along one; `null` when diagonal. */
  axis: "x" | "y" | "z" | null;
  /** The closest meshes, one from each side. */
  between: [string, string];
};

/** A 4 × 4 column-major matrix, as three stores them. */
type Elements = ArrayLike<number>;

const multiply = (a: Elements, b: Elements, out: number[]) => {
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

type Triangle = (
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

/** Every triangle a mesh draws, in world space: each instance of an instanced or batched mesh. */
const eachTriangle = (mesh: Mesh, visit: Triangle) => {
  const { index, attributes } = mesh.geometry;
  const position = attributes.position;

  if (!position) {
    return;
  }

  const world = mesh.matrixWorld.elements;
  const corner = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const emit = (matrix: Elements, first: number, count: number, indexed: boolean) => {
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

      visit(
        ...(corner as [number, number, number, number, number, number, number, number, number]),
      );
    }
  };

  if (isBatched(mesh)) {
    const batch = mesh as BatchedMesh;
    const instance = Array.from({ length: 16 }, () => 0);
    const matrix = Array.from({ length: 16 }, () => 0);
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

      multiply(world, instance, matrix);

      if (index) {
        emit(matrix, range.indexStart, range.indexCount, true);
      } else {
        emit(matrix, range.vertexStart, range.vertexCount, false);
      }
    }

    return;
  }

  const { start, count } = mesh.geometry.drawRange;
  const elements = index?.count ?? position.count;
  const first = Math.min(start, elements);
  const drawn = Math.min(elements, start + count) - first;

  if (isInstanced(mesh)) {
    const matrix = Array.from({ length: 16 }, () => 0);
    const instances = mesh.instanceMatrix.array;

    for (let i = 0; i < mesh.count; i += 1) {
      multiply(world, Array.prototype.slice.call(instances, i * 16, i * 16 + 16), matrix);
      emit(matrix, first, drawn, index !== null);
    }

    return;
  }

  emit(world, first, drawn, index !== null);
};

/** A box as [minX, minY, minZ, maxX, maxY, maxZ]. */
type Box = [number, number, number, number, number, number];

const emptyBox = (): Box => [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];

const grow = (box: Box, x: number, y: number, z: number) => {
  box[0] = Math.min(box[0], x);
  box[1] = Math.min(box[1], y);
  box[2] = Math.min(box[2], z);
  box[3] = Math.max(box[3], x);
  box[4] = Math.max(box[4], y);
  box[5] = Math.max(box[5], z);
};

/** Per axis, how far apart two boxes are (0 where they overlap). */
const apart = (
  a: ArrayLike<number>,
  ai: number,
  b: ArrayLike<number>,
  bi: number,
  out: number[],
) => {
  for (let axis = 0; axis < 3; axis += 1) {
    out[axis] = Math.max(0, a[ai + axis]! - b[bi + axis + 3]!, b[bi + axis]! - a[ai + axis + 3]!);
  }

  return Math.hypot(out[0]!, out[1]!, out[2]!);
};

const round = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000;

  return rounded === 0 ? 0 : rounded;
};

/** The visible meshes a target stands for. */
const meshesOf = (root: Object3D, target: Target, tagKey: string, role: string) => {
  let objects: Object3D[];

  if (typeof target === "string") {
    const tagged: Object3D[] = [];
    const named: Object3D[] = [];

    walk(root, {}, (object) => {
      const tag: unknown = object.userData[tagKey];

      if (tag !== undefined && tag !== null && String(tag) === target) {
        tagged.push(object);
      } else if (object.name === target) {
        named.push(object);
      }
    });
    objects = tagged.length > 0 ? tagged : named;

    if (objects.length === 0) {
      throw new Error(
        `three-audit: ${role}: nothing is tagged userData.${tagKey} = "${target}" or named "${target}"`,
      );
    }
  } else {
    objects = [asObject3D(target)];
  }

  const meshes = new Set<Mesh>();

  for (const object of objects) {
    walk(object, { visibleOnly: true }, (child) => {
      if (isMesh(child)) {
        meshes.add(child);
      }
    });
  }

  return meshes;
};

/** A target's world envelope, from its visible meshes' vertices; `null` when it draws nothing. */
export const measureBounds = (
  root: AnyObject3D,
  target: Target,
  options: MeasureOptions = {},
): Bounds | null => {
  const scene = asObject3D(root);

  scene.updateWorldMatrix(true, true);

  const box = emptyBox();

  for (const mesh of meshesOf(scene, target, options.tagKey ?? "studioObject", "bounds")) {
    eachTriangle(mesh, (ax, ay, az, bx, by, bz, cx, cy, cz) => {
      grow(box, ax, ay, az);
      grow(box, bx, by, bz);
      grow(box, cx, cy, cz);
    });
  }

  if (box[0] > box[3]) {
    return null;
  }

  const min = [box[0], box[1], box[2]].map(round) as Bounds["min"];
  const max = [box[3], box[4], box[5]].map(round) as Bounds["max"];

  return {
    min,
    max,
    size: [0, 1, 2].map((axis) => round(box[axis + 3]! - box[axis]!)) as Bounds["size"],
    centre: [0, 1, 2].map((axis) => round((box[axis]! + box[axis + 3]!) / 2)) as Bounds["centre"],
  };
};

/** Triangle boxes past this many pairs, a mesh pair is measured by its whole boxes instead. */
const PAIR_LIMIT = 4_000_000;

type Measured = { mesh: Mesh; box: Box; triangles: Float64Array | null };

/**
 * The gap between two targets, and which of their meshes come closest. Throws when a target
 * matches nothing; `null` when either draws nothing. Meshes in both targets are left out of `a`.
 */
export const measureClearance = (
  root: AnyObject3D,
  a: Target,
  b: Target,
  options: MeasureOptions = {},
): Clearance | null => {
  const scene = asObject3D(root);
  const tagKey = options.tagKey ?? "studioObject";

  scene.updateWorldMatrix(true, true);

  const inB = meshesOf(scene, b, tagKey, "clearance b");
  const inA = [...meshesOf(scene, a, tagKey, "clearance a")].filter((mesh) => !inB.has(mesh));
  const measure = (mesh: Mesh): Measured => {
    const box = emptyBox();

    eachTriangle(mesh, (ax, ay, az, bx, by, bz, cx, cy, cz) => {
      grow(box, ax, ay, az);
      grow(box, bx, by, bz);
      grow(box, cx, cy, cz);
    });

    return { mesh, box, triangles: null };
  };
  const sideA = inA.map(measure).filter(({ box }) => box[0] <= box[3]);
  const sideB = [...inB].map(measure).filter(({ box }) => box[0] <= box[3]);

  if (sideA.length === 0 || sideB.length === 0) {
    return null;
  }

  const trianglesOf = (side: Measured) => {
    if (!side.triangles) {
      const boxes: number[] = [];

      eachTriangle(side.mesh, (ax, ay, az, bx, by, bz, cx, cy, cz) => {
        boxes.push(
          Math.min(ax, bx, cx),
          Math.min(ay, by, cy),
          Math.min(az, bz, cz),
          Math.max(ax, bx, cx),
          Math.max(ay, by, cy),
          Math.max(az, bz, cz),
        );
      });
      side.triangles = Float64Array.from(boxes);
    }

    return side.triangles;
  };

  const axes = [0, 0, 0];
  const pairs = sideA
    .flatMap((left) =>
      sideB.map((right) => ({ left, right, distance: apart(left.box, 0, right.box, 0, axes) })),
    )
    .sort((x, y) => x.distance - y.distance);
  let best = Infinity;
  let bestAxes = [0, 0, 0];
  let between: [Mesh, Mesh] = [pairs[0]!.left.mesh, pairs[0]!.right.mesh];

  for (const { left, right, distance } of pairs) {
    if (distance >= best) {
      break;
    }

    const leftTriangles = trianglesOf(left);
    const rightTriangles = trianglesOf(right);
    // Only triangles that could beat the best so far, measured against the other mesh's box.
    const near = (triangles: Float64Array, other: Box) => {
      const kept: number[] = [];

      for (let t = 0; t < triangles.length; t += 6) {
        if (apart(triangles, t, other, 0, axes) < best) {
          kept.push(t);
        }
      }

      return kept;
    };
    const nearLeft = near(leftTriangles, right.box);
    const nearRight = near(rightTriangles, left.box);

    if (nearLeft.length * nearRight.length > PAIR_LIMIT) {
      if (distance < best) {
        best = distance;
        apart(left.box, 0, right.box, 0, axes);
        bestAxes = [...axes];
        between = [left.mesh, right.mesh];
      }

      continue;
    }

    for (const i of nearLeft) {
      for (const j of nearRight) {
        const gap = apart(leftTriangles, i, rightTriangles, j, axes);

        if (gap < best) {
          best = gap;
          bestAxes = [...axes];
          between = [left.mesh, right.mesh];
        }
      }
    }
  }

  const separated = bestAxes.flatMap((value, axis) => (value > 0 ? [axis] : []));

  return {
    gap: round(best),
    axis: separated.length === 1 ? (["x", "y", "z"] as const)[separated[0]!]! : null,
    between: [meshLabel(between[0], scene, tagKey), meshLabel(between[1], scene, tagKey)],
  };
};
