/**
 * Where a frame's draw calls and triangles come from, estimated from the
 * scene graph the way three's renderer walks it: hidden objects, other
 * layers and anything outside the camera's frustum are left out; each
 * visible material (or material group) is one draw call, two for a
 * transparent double-sided material. Main pass only: shadow maps and
 * post-processing passes aren't counted.
 *
 * Structural like the rest of core: no import of three, every field read
 * defensively, since this runs against whatever the app renders.
 */
import type { CostEntry, SceneCost } from "./types.ts";

type Elements = ArrayLike<number>;

type Sphere = { center: { x: number; y: number; z: number }; radius: number };

type GeometryShape = {
  attributes?: { position?: { count: number } };
  boundingSphere?: Sphere | null;
  drawRange?: { count: number; start: number };
  groups?: { count: number; materialIndex?: number; start: number }[];
  index?: { count: number } | null;
  name?: string;
  uuid?: string;
};

type MaterialShape = {
  forceSinglePass?: boolean;
  name?: string;
  side?: number;
  transparent?: boolean;
  type?: string;
  visible?: boolean;
};

type ObjectShape = {
  boundingSphere?: Sphere | null;
  count?: number;
  frustumCulled?: boolean;
  geometry?: GeometryShape;
  isInstancedMesh?: boolean;
  isLine?: boolean;
  isMesh?: boolean;
  isPoints?: boolean;
  isSprite?: boolean;
  layers?: { mask: number };
  material?: MaterialShape | MaterialShape[];
  matrixWorld?: { elements: Elements };
  name?: string;
  type?: string;
};

type CameraShape = {
  coordinateSystem?: number;
  layers?: { mask: number };
  matrixWorldInverse?: { elements: Elements };
  projectionMatrix?: { elements: Elements };
  reversedDepth?: boolean;
};

type SceneShape = { traverseVisible?: (callback: (object: ObjectShape) => void) => void };

/** three's `DoubleSide` and `WebGPUCoordinateSystem`. */
const DOUBLE_SIDE = 2;
const WEBGPU_COORDINATES = 2001;

type Plane = [number, number, number, number];

/** Column-major `a × b`, as three stores matrices. */
const multiply = (a: Elements, b: Elements) => {
  const out = Array.from<number>({ length: 16 });

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;

      for (let k = 0; k < 4; k += 1) {
        sum += a[k * 4 + row]! * b[column * 4 + k]!;
      }

      out[column * 4 + row] = sum;
    }
  }

  return out;
};

const normalize = (plane: Plane): Plane => {
  const length = Math.hypot(plane[0], plane[1], plane[2]) || 1;

  return [plane[0] / length, plane[1] / length, plane[2] / length, plane[3] / length];
};

/** Mirrors three's `Frustum.setFromProjectionMatrix`. Near and far only where the depth range is known. */
const frustumPlanes = (camera: CameraShape): Plane[] | null => {
  if (!camera.projectionMatrix || !camera.matrixWorldInverse) {
    return null;
  }

  const m = multiply(camera.projectionMatrix.elements, camera.matrixWorldInverse.elements);
  const row = (index: number): Plane => [m[index]!, m[index + 4]!, m[index + 8]!, m[index + 12]!];
  const [r0, r1, r2, r3] = [row(0), row(1), row(2), row(3)];
  const add = (a: Plane, b: Plane): Plane => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];
  const sub = (a: Plane, b: Plane): Plane => [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]];

  const planes = [sub(r3, r0), add(r3, r0), add(r3, r1), sub(r3, r1)];

  if (!camera.reversedDepth) {
    planes.push(sub(r3, r2), camera.coordinateSystem === WEBGPU_COORDINATES ? r2 : add(r3, r2));
  }

  return planes.map(normalize);
};

const inFrustum = (object: ObjectShape, planes: Plane[] | null) => {
  const sphere = object.boundingSphere ?? object.geometry?.boundingSphere;
  const e = object.matrixWorld?.elements;

  // three computes bounding spheres lazily while rendering; without one, count the object.
  if (!planes || !sphere || !e) {
    return true;
  }

  const { x, y, z } = sphere.center;
  const cx = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
  const cy = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
  const cz = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;
  const scale = Math.sqrt(
    Math.max(
      e[0]! ** 2 + e[1]! ** 2 + e[2]! ** 2,
      e[4]! ** 2 + e[5]! ** 2 + e[6]! ** 2,
      e[8]! ** 2 + e[9]! ** 2 + e[10]! ** 2,
    ),
  );
  const radius = sphere.radius * scale;

  // three's own test, `distance < -radius`. Written this way round a NaN plane (a camera with a
  // zero-size aspect, say) keeps the object, as three does, rather than hiding everything.
  return !planes.some(([a, b, c, d]) => a * cx + b * cy + c * cz + d < -radius);
};

const layersMatch = (object: ObjectShape, camera: CameraShape) =>
  !object.layers || !camera.layers || (object.layers.mask & camera.layers.mask) !== 0;

const passes = (material: MaterialShape) =>
  material.transparent === true &&
  material.side === DOUBLE_SIDE &&
  material.forceSinglePass !== true
    ? 2
    : 1;

/** Vertices a draw covers, clipped to `drawRange` and, when given, a group. */
const drawnVertices = (
  geometry: GeometryShape,
  group?: { count: number; start: number },
): number => {
  const total = geometry.index?.count ?? geometry.attributes?.position?.count ?? 0;
  const rangeStart = geometry.drawRange?.start ?? 0;
  const rangeEnd = Math.min(total, rangeStart + (geometry.drawRange?.count ?? Infinity));
  const start = Math.max(rangeStart, group?.start ?? 0);
  const end = Math.min(rangeEnd, group ? group.start + group.count : Infinity);

  return Math.max(0, end - start);
};

type Draw = { calls: number; material: MaterialShape; triangles: number };

/** One draw per visible material, or per group when the material is an array. */
const drawsOf = (object: ObjectShape): Draw[] => {
  const { geometry, material } = object;

  if (!geometry || !material) {
    return [];
  }

  const instances = object.isInstancedMesh ? (object.count ?? 1) : 1;
  const trianglesFor = (vertices: number) =>
    object.isMesh ? Math.floor(vertices / 3) * instances : 0;

  if (Array.isArray(material)) {
    const draws: Draw[] = [];

    for (const group of geometry.groups ?? []) {
      const groupMaterial = material[group.materialIndex ?? 0];

      if (groupMaterial && groupMaterial.visible !== false) {
        const count = passes(groupMaterial);
        draws.push({
          calls: count,
          material: groupMaterial,
          triangles: trianglesFor(drawnVertices(geometry, group)) * count,
        });
      }
    }

    return draws;
  }

  return material.visible === false
    ? []
    : [
        {
          calls: passes(material),
          material,
          // A second pass draws the triangles again, and three's info counts them again.
          triangles: trianglesFor(drawnVertices(geometry)) * passes(material),
        },
      ];
};

const objectLabel = (object: ObjectShape) =>
  object.name || object.geometry?.name || object.type || "Object";

const materialLabel = (material: MaterialShape) => material.name || material.type || "Material";

const entryFor = (groups: Map<unknown, CostEntry>, key: unknown, label: string) => {
  let entry = groups.get(key);

  if (!entry) {
    entry = { calls: 0, instances: 0, label, objects: [], triangles: 0 };
    groups.set(key, entry);
  }

  return entry;
};

const byCost = (a: CostEntry, b: CostEntry) => b.calls - a.calls || b.triangles - a.triangles;

const computeSceneCost = (scene: unknown, camera: unknown): SceneCost | null => {
  const root = scene as SceneShape;
  const view = camera as CameraShape;

  if (typeof root?.traverseVisible !== "function") {
    return null;
  }

  const planes = frustumPlanes(view);
  // Same label and geometry is one row, so 500 unmerged copies read as "tree ×500".
  const meshes = new Map<unknown, CostEntry>();
  const materials = new Map<unknown, CostEntry>();
  let calls = 0;
  let triangles = 0;

  root.traverseVisible((object) => {
    const drawable = object.isMesh || object.isLine || object.isPoints || object.isSprite;

    if (!drawable || !layersMatch(object, view)) {
      return;
    }

    if (object.frustumCulled !== false && !object.isSprite && !inFrustum(object, planes)) {
      return;
    }

    const instances = object.isInstancedMesh ? (object.count ?? 1) : 1;
    const label = objectLabel(object);
    const meshKey = `${label}\u0000${object.geometry?.uuid ?? ""}`;

    const draws = drawsOf(object);

    if (draws.length === 0) {
      return;
    }

    const mesh = entryFor(meshes, meshKey, label);
    mesh.objects.push(object);
    mesh.instances += instances;
    // A multi-material object can draw one material in several groups; list it once per material.
    const listed = new Set<MaterialShape>();

    for (const draw of draws) {
      calls += draw.calls;
      triangles += draw.triangles;
      mesh.calls += draw.calls;
      mesh.triangles += draw.triangles;

      const material = entryFor(materials, draw.material, materialLabel(draw.material));
      material.calls += draw.calls;
      material.triangles += draw.triangles;

      if (!listed.has(draw.material)) {
        listed.add(draw.material);
        material.objects.push(object);
        material.instances += instances;
      }
    }
  });

  return {
    calls,
    materials: [...materials.values()].sort(byCost),
    meshes: [...meshes.values()].sort(byCost),
    triangles,
  };
};

export { computeSceneCost };
