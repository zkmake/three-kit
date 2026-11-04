/**
 * Meshes with no name, whose rows in every other check read `Mesh [MeshBasicMaterial]`, and can't
 * be found again. A mesh counts as named when it, or its geometry, has a name (`meshName`), other
 * than the `mesh_0` a glTF loader gives one the file left unnamed.
 */
import type { Mesh } from "three";

import {
  type AnyObject3D,
  asObject3D,
  type Bakes,
  isBatched,
  isInstanced,
  isMesh,
  meshLabel,
  type Skip,
  triangleCount,
  walk,
  withHidden,
} from "./scene.ts";

export type UnnamedOptions = {
  skip?: Skip | undefined;
  tagKey?: string;
  /** A bake's parts (default), or its merged meshes: see `Bakes`. */
  bakes?: Bakes | undefined;
};

export type UnnamedRow = {
  /** `path/to/BoxGeometry [material]`: what every other check calls it now. */
  mesh: string;
  /** Triangles across its copies, so the rows that matter most come first. */
  triangles: number;
  /** Meshes folded into this row: same place, same geometry type, same material. */
  count: number;
  /** Not enumerable: kept out of JSON and `console.table`. The first one folded in. */
  readonly object: Mesh;
};

/** What `GLTFLoader` calls a mesh the file left unnamed: a name that says no more than none. */
const LOADER_NAME = /^mesh_\d+(_\d+)?$/;

/** Visible meshes with no name of their own or on their geometry, most triangles first. */
export const findUnnamedMeshes = (
  root: AnyObject3D,
  options: UnnamedOptions = {},
): UnnamedRow[] => {
  const scene = asObject3D(root);
  const tagKey = options.tagKey ?? "studioObject";
  const rows = new Map<string, UnnamedRow>();

  walk(
    scene,
    { skip: options.skip, visibleOnly: true, bakes: options.bakes ?? "sources" },
    (object) => {
      if (
        !isMesh(object) ||
        (object.name && !LOADER_NAME.test(object.name)) ||
        object.geometry.name
      ) {
        return;
      }

      const copies = isInstanced(object) ? object.count : 1;
      const triangles = isBatched(object) ? 0 : triangleCount(object.geometry) * copies;
      const label = meshLabel(object, scene, tagKey);
      const known = rows.get(label);

      if (known) {
        known.count += 1;
        known.triangles += triangles;
      } else {
        rows.set(label, withHidden({ mesh: label, triangles, count: 1 }, "object", object));
      }
    },
  );

  return [...rows.values()].sort((a, b) => b.triangles - a.triangles);
};
