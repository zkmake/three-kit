/**
 * What's drawn over what's already drawn: every transparent or additive mesh, point cloud and
 * sprite shades each pixel it covers again, and nothing culls it. Counts them, and with a camera
 * adds how many screens' worth they cover, from each piece's box as that camera sees it: an upper
 * bound, as a box covers more than the shape in it.
 */
import type { Camera, Material, Mesh, Object3D } from "three";

import { type Box, eachPiece, eachPieceTriangle, emptyBox, grow, viewProjection } from "./drawn.ts";
import {
  type AnyObject3D,
  asObject3D,
  isDrawable,
  isMesh,
  materialsOf,
  meshLabel,
  type Skip,
  walk,
} from "./scene.ts";

export type TransparentOptions = {
  /** Adds `screens`: how much of this camera's view each one covers. */
  camera?: Camera | undefined;
  skip?: Skip | undefined;
  tagKey?: string;
};

export type TransparentRow = {
  /** `path/to/mesh [material]`. */
  mesh: string;
  /** Draws: one each, one per material group when a mesh has several. */
  draws: number;
  /** Triangles across its instances; 0 for points and lines. */
  triangles: number;
  /** Instances, or 1. */
  instances: number;
  /** Screens' worth it covers (1 = the whole view once), `null` without a camera. */
  screens: number | null;
  /** Not enumerable: kept out of JSON and `console.table`. */
  readonly object: Object3D;
};

export type TransparentOverdraw = {
  draws: number;
  triangles: number;
  /**
   * Screens' worth of extra shading a frame, all summed: `3` shades every pixel three more times.
   * `null` without a camera.
   */
  screens: number | null;
  /** The most screens first, else the most triangles. */
  rows: TransparentRow[];
};

/** three's `NormalBlending`. */
const NORMAL_BLENDING = 1;

const round = (value: number, places = 2) => {
  const scale = 10 ** places;

  return Math.round(value * scale) / scale;
};

const blends = (material: Material) =>
  material.visible !== false &&
  (material.transparent === true || material.blending !== NORMAL_BLENDING);

/** How much of the view a box covers, 0 to 1. A box reaching behind the camera counts as all of it. */
const coverage = (matrix: number[], box: Box) => {
  let left = Infinity;
  let right = -Infinity;
  let bottom = Infinity;
  let top = -Infinity;
  let behind = false;
  let front = false;

  for (let i = 0; i < 8; i += 1) {
    const x = box[i & 1 ? 3 : 0];
    const y = box[i & 2 ? 4 : 1];
    const z = box[i & 4 ? 5 : 2];
    const w = matrix[3]! * x + matrix[7]! * y + matrix[11]! * z + matrix[15]!;

    if (w <= 1e-6) {
      behind = true;
      continue;
    }

    front = true;

    const px = (matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!) / w;
    const py = (matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!) / w;

    left = Math.min(left, px);
    right = Math.max(right, px);
    bottom = Math.min(bottom, py);
    top = Math.max(top, py);
  }

  if (!front) {
    return 0;
  }

  if (behind) {
    return 1;
  }

  const width = Math.min(right, 1) - Math.max(left, -1);
  const height = Math.min(top, 1) - Math.max(bottom, -1);

  return width > 0 && height > 0 ? (width * height) / 4 : 0;
};

const boxOfPositions = (object: Object3D) => {
  const { geometry } = object as Mesh;
  const position = geometry?.attributes?.position;
  const box = emptyBox();

  if (!position || position.itemSize < 3) {
    return null;
  }

  const e = object.matrixWorld.elements;

  for (let v = 0; v < position.count; v += 1) {
    const x = position.getX(v);
    const y = position.getY(v);
    const z = position.getZ(v);

    grow(
      box,
      e[0]! * x + e[4]! * y + e[8]! * z + e[12]!,
      e[1]! * x + e[5]! * y + e[9]! * z + e[13]!,
      e[2]! * x + e[6]! * y + e[10]! * z + e[14]!,
    );
  }

  return box[0] > box[3] ? null : box;
};

/** Every blended draw, what it costs, and with a camera what it covers. */
export const transparentOverdraw = (
  scene: AnyObject3D,
  options: TransparentOptions = {},
): TransparentOverdraw => {
  const root = asObject3D(scene);
  const tagKey = options.tagKey ?? "studioObject";
  const { camera, skip } = options;
  let view: number[] | null = null;

  root.updateWorldMatrix(true, true);

  if (camera) {
    view = viewProjection(camera);
  }

  const rows: TransparentRow[] = [];

  walk(root, { skip, visibleOnly: true, bakes: "merged" }, (object) => {
    if (!isDrawable(object)) {
      return;
    }

    const materials = materialsOf(object as Mesh);

    if (materials.length === 0 || !materials.some(blends)) {
      return;
    }

    const mesh = object as Mesh;
    const groups = mesh.geometry?.groups?.length ?? 0;
    const draws = Math.max(1, Array.isArray(mesh.material) ? groups : 1);
    let triangles = 0;
    let instances = 0;
    let screens = view ? 0 : null;

    if (isMesh(object)) {
      eachPiece(mesh, (piece) => {
        instances += 1;
        triangles += Math.floor(piece.count / 3);

        if (view) {
          const box = emptyBox();

          eachPieceTriangle(mesh, piece, (ax, ay, az, bx, by, bz, cx, cy, cz) => {
            grow(box, ax, ay, az);
            grow(box, bx, by, bz);
            grow(box, cx, cy, cz);
          });
          screens! += box[0] > box[3] ? 0 : coverage(view, box);
        }
      });
    } else {
      instances = 1;

      const box = view ? boxOfPositions(object) : null;

      screens = view ? (box ? coverage(view, box) : 0) : null;
    }

    const label = isMesh(object)
      ? meshLabel(object, root, tagKey)
      : `${object.name || object.type} [${materials[0]!.name || materials[0]!.type}]`;

    rows.push(
      Object.defineProperty(
        {
          mesh: label,
          draws,
          triangles,
          instances: Math.max(1, instances),
          screens: screens === null ? null : round(screens),
        },
        "object",
        { value: object, enumerable: false },
      ) as TransparentRow,
    );
  });

  rows.sort((a, b) => (b.screens ?? 0) - (a.screens ?? 0) || b.triangles - a.triangles);

  return {
    draws: rows.reduce((sum, row) => sum + row.draws, 0),
    triangles: rows.reduce((sum, row) => sum + row.triangles, 0),
    screens: view ? round(rows.reduce((sum, row) => sum + (row.screens ?? 0), 0)) : null,
    rows,
  };
};
