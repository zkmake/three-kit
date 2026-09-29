/**
 * Geometry that lights a pixel NaN: a non-finite position or normal, or a zero-length normal on a
 * triangle with area. Bloom and other blurs spread one NaN pixel into a black block.
 */
import type { BufferGeometry, Mesh } from "three";

import {
  type AnyObject3D,
  asObject3D,
  isMesh,
  meshName,
  type Skip,
  tagOf,
  walk,
  withHidden,
} from "./scene.ts";

export type BadGeometryOptions = {
  skip?: Skip | undefined;
  /** `userData` key naming the part a mesh belongs to, for the `under` column. */
  tagKey?: string;
};

export type BadGeometryRow = {
  mesh: string;
  /** The tagged part it sits in, or its parent's name. */
  under: string;
  /** Vertices with a NaN or infinite position or normal component. */
  nonFinite: number;
  /** Vertices of triangles with area whose normal has no length. */
  zeroNormals: number;
  /** Not enumerable: kept out of JSON and `console.table`. */
  readonly object: Mesh;
};

const corner = (geometry: BufferGeometry, k: number) => geometry.index?.getX(k) ?? k;

const check = (geometry: BufferGeometry) => {
  const position = geometry.attributes.position!;
  const normal = geometry.attributes.normal;
  const flagged = new Uint8Array(position.count);
  let nonFinite = 0;
  let zeroNormals = 0;

  for (let v = 0; v < position.count; v += 1) {
    const finite =
      Number.isFinite(position.getX(v)) &&
      Number.isFinite(position.getY(v)) &&
      Number.isFinite(position.getZ(v)) &&
      (!normal ||
        (Number.isFinite(normal.getX(v)) &&
          Number.isFinite(normal.getY(v)) &&
          Number.isFinite(normal.getZ(v))));

    if (!finite) {
      flagged[v] = 1;
      nonFinite += 1;
    }
  }

  if (!normal) {
    return { nonFinite, zeroNormals };
  }

  const corners = geometry.index?.count ?? position.count;

  for (let k = 0; k + 2 < corners; k += 3) {
    const a = corner(geometry, k);
    const b = corner(geometry, k + 1);
    const c = corner(geometry, k + 2);
    const ux = position.getX(b) - position.getX(a);
    const uy = position.getY(b) - position.getY(a);
    const uz = position.getZ(b) - position.getZ(a);
    const vx = position.getX(c) - position.getX(a);
    const vy = position.getY(c) - position.getY(a);
    const vz = position.getZ(c) - position.getZ(a);
    const area = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);

    if (!(area > 1e-8)) {
      continue;
    }

    for (const v of [a, b, c]) {
      if (flagged[v] === 0 && Math.hypot(normal.getX(v), normal.getY(v), normal.getZ(v)) < 1e-4) {
        flagged[v] = 1;
        zeroNormals += 1;
      }
    }
  }

  return { nonFinite, zeroNormals };
};

/** Meshes with geometry that renders NaN, hidden ones included. `[]` is a pass. */
export const findBadGeometry = (
  root: AnyObject3D,
  options: BadGeometryOptions = {},
): BadGeometryRow[] => {
  const tagKey = options.tagKey ?? "studioObject";
  const rows: BadGeometryRow[] = [];

  walk(asObject3D(root), { skip: options.skip }, (object) => {
    if (!isMesh(object) || !object.geometry.attributes.position) {
      return;
    }

    const { nonFinite, zeroNormals } = check(object.geometry);

    if (nonFinite > 0 || zeroNormals > 0) {
      const under = tagOf(object, tagKey) ?? object.parent?.name ?? "";

      rows.push(
        withHidden({ mesh: meshName(object), under, nonFinite, zeroNormals }, "object", object),
      );
    }
  });

  return rows;
};
