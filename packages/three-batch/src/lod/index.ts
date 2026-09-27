/**
 * `@zkmake/three-batch/lod`: far copies made by the machine. meshoptimizer's edge collapse
 * simplifies a geometry to within a set distance of its surface; pick the distance from the camera
 * so what's lost is under a pixel. Hard edges survive: a welded geometry keeps split normals at
 * creases, which the simplifier treats as seams.
 *
 * Needs `meshoptimizer` (its wasm is embedded; nothing is fetched). Importing this entry waits the
 * few milliseconds it takes to start.
 */
import { MeshoptSimplifier } from "meshoptimizer";
import { BufferAttribute, BufferGeometry, type Mesh, type Object3D } from "three";

import { weld } from "../harmonize.ts";

await MeshoptSimplifier.ready;

export type SimplifyOptions = {
  /** `null` unless the far copy saves at least this share of triangles. Default 0.1. */
  minSaving?: number;
};

const positionsOf = (geometry: BufferGeometry) => {
  const position = geometry.attributes.position!;

  if (position.array instanceof Float32Array && position.itemSize === 3 && !("data" in position)) {
    return position.array;
  }

  const out = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i += 1) {
    out[i * 3] = position.getX(i);
    out[i * 3 + 1] = position.getY(i);
    out[i * 3 + 2] = position.getZ(i);
  }

  return out;
};

/**
 * A copy of an indexed geometry simplified to within `error` world units of its surface, with
 * pieces smaller than that pruned. It shares the original's vertex buffers under a shorter index,
 * so colours, normals and every other attribute carry over. `null` if it would save little.
 * `weld` an unindexed or split geometry first.
 */
export const simplify = (
  geometry: BufferGeometry,
  error: number,
  options: SimplifyOptions = {},
): BufferGeometry | null => {
  const index = geometry.index;

  if (!index) {
    throw new Error("three-batch: simplify takes an indexed geometry; weld it first");
  }

  const [indices] = MeshoptSimplifier.simplify(
    new Uint32Array(index.array),
    positionsOf(geometry),
    3,
    0,
    error,
    ["ErrorAbsolute", "Prune"],
  );

  if (indices.length > index.count * (1 - (options.minSaving ?? 0.1))) {
    return null;
  }

  const far = new BufferGeometry();

  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    far.setAttribute(name, attribute);
  }

  far.setIndex(new BufferAttribute(indices, 1));
  far.name = `${geometry.name}:far`;

  return far;
};

const triangles = (geometry: BufferGeometry) =>
  (geometry.index?.count ?? geometry.attributes.position?.count ?? 0) / 3;

/**
 * What far copies would save before one is wired in: per tagged object (`userData[tagKey]`),
 * triangles in full, then welded and simplified to each error. Meshes outside a tag are left out.
 */
export const simplifyReport = (
  root: Object3D,
  errors: readonly number[],
  { tagKey = "studioObject" }: { tagKey?: string } = {},
) => {
  const rows: Record<string, number[]> = {};

  root.traverse((object) => {
    const mesh = object as Mesh;

    if (mesh.isMesh !== true || !mesh.geometry.attributes.position) {
      return;
    }

    let tagged: Object3D | null = mesh;

    while (tagged && tagged.userData[tagKey] === undefined) {
      tagged = tagged.parent;
    }

    if (!tagged) {
      return;
    }

    const tag = String(tagged.userData[tagKey]);
    const welded = weld(mesh.geometry);
    const counts = [
      triangles(welded),
      ...errors.map((error) => {
        const far = simplify(welded, error, { minSaving: 0 });

        return far ? triangles(far) : triangles(welded);
      }),
    ];

    rows[tag] = (rows[tag] ?? counts.map(() => 0)).map((sum, k) => sum + counts[k]!);
    welded.dispose();
  });

  return rows;
};

export { weld } from "../harmonize.ts";
