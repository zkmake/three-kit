/**
 * Measuring a layout: an object's world envelope, and the gap between two objects. The questions
 * a scene raises before anything renders wrong: does the train fit under the crossbar, does the
 * lid clear the hinge.
 *
 * Measured from the vertices as drawn (instances and batches included), not from bounding boxes
 * transformed after the fact, which grow with every rotation.
 */
import type { Mesh, Object3D } from "three";

import { type Box, eachTriangle, emptyBox, grow } from "./drawn.ts";
import { type AnyObject3D, asObject3D, type Bakes, isMesh, meshLabel, walk } from "./scene.ts";

export type MeasureOptions = {
  /** `userData` key a string target is looked up by. Default `studioObject`. */
  tagKey?: string;
  /** A bake's parts (default), or its merged meshes: see `Bakes`. The same space either way. */
  bakes?: Bakes | undefined;
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
export const meshesOf = (
  root: Object3D,
  target: Target,
  { tagKey = "studioObject", bakes = "sources" }: MeasureOptions,
  role: string,
) => {
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
    walk(object, { visibleOnly: true, bakes }, (child) => {
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

  for (const mesh of meshesOf(scene, target, options, "bounds")) {
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

  const inB = meshesOf(scene, b, options, "clearance b");
  const inA = [...meshesOf(scene, a, options, "clearance a")].filter((mesh) => !inB.has(mesh));
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
