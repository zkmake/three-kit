/**
 * Shadow setups that draw wrong, read off the scene without rendering: a renderer with shadows off
 * or on a removed map type, a light casting on nothing, casters outside the shadow camera, a shadow
 * camera far bigger than what it covers, and bias at either extreme.
 */
import type { Camera, Light, LightShadow, Mesh, Object3D } from "three";

import { type Box, drawsWhereStored, drawnPieces, multiply, viewProjection } from "./drawn.ts";
import { type AnyObject3D, asObject3D, isMesh, meshName, type Skip, walk } from "./scene.ts";

/** The parts of a renderer the setup checks read: `WebGLRenderer` and `WebGPURenderer` both have them. */
export type SetupRenderer = {
  shadowMap?: { enabled: boolean; type?: number } | undefined;
  outputColorSpace?: string | undefined;
  toneMapping?: number | undefined;
  toneMappingExposure?: number | undefined;
};

export type ShadowProblem =
  | "shadows-off"
  | "removed-map-type"
  | "no-shadow-light"
  | "no-casters"
  | "no-receivers"
  | "casters-outside"
  | "camera-too-big"
  | "no-bias"
  | "bias-too-big";

export type ShadowOptions = {
  /** Lets the check read `shadowMap`. Without it, only what the scene itself says is checked. */
  renderer?: SetupRenderer | undefined;
  /**
   * The player's camera. A shadow camera fitted around the player leaves what's far away out on
   * purpose, so with this only a hole counts: a caster in view, nearer than one it does cover.
   * Without it, every caster counts.
   */
  camera?: Camera | undefined;
  skip?: Skip | undefined;
  /** Share of the shadow camera's view the casters may leave empty. Default 0.75. */
  emptyShare?: number;
};

export type ShadowIssue = {
  /** The light, or `renderer` or `scene` when it isn't about one light. */
  subject: string;
  problem: ShadowProblem;
  /** What's wrong in numbers, and what to do. */
  detail: string;
  /** Not enumerable: kept out of JSON and `console.table`. The light, when there is one. */
  readonly object: Object3D | null;
};

/** `PCFSoftShadowMap`: three warns and falls back to PCF. */
const REMOVED_MAP_TYPE = 2;
/** `VSMShadowMap`: blurs instead of comparing, so bias doesn't work the same way. */
const VSM = 3;
/** Bias past this many shadow texels lifts shadows visibly off what casts them. */
const BIG_BIAS_TEXELS = 10;

type ShadowLight = Light & {
  isDirectionalLight?: boolean;
  isSpotLight?: boolean;
  isPointLight?: boolean;
  shadow: LightShadow<Camera> & {
    camera: Camera & { left?: number; right?: number; near?: number; far?: number; zoom?: number };
  };
};

const labelOf = (light: Object3D) => light.name || light.type;

const issue = (
  subject: string,
  problem: ShadowProblem,
  detail: string,
  object: Object3D | null = null,
): ShadowIssue => {
  const row = { subject, problem, detail };

  return Object.defineProperty(row, "object", { value: object, enumerable: false }) as ShadowIssue;
};

const corners = (box: Box) =>
  [0, 1, 2, 3, 4, 5, 6, 7].map(
    (i) => [box[i & 1 ? 3 : 0], box[i & 2 ? 4 : 1], box[i & 4 ? 5 : 2]] as const,
  );

/** A box in the shadow camera's view: where its centre lands, and its extent clipped to the view. */
const inView = (matrix: number[], box: Box) => {
  const project = (x: number, y: number, z: number) => {
    const w = matrix[3]! * x + matrix[7]! * y + matrix[11]! * z + matrix[15]!;
    const k = w > 1e-9 ? 1 / w : 0;

    return {
      front: w > 1e-9,
      x: (matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!) * k,
      y: (matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!) * k,
      z: (matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!) * k,
    };
  };
  const centre = project((box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2);
  let left = Infinity;
  let right = -Infinity;
  let bottom = Infinity;
  let top = -Infinity;

  for (const [x, y, z] of corners(box)) {
    const point = project(x, y, z);

    if (point.front) {
      left = Math.min(left, point.x);
      right = Math.max(right, point.x);
      bottom = Math.min(bottom, point.y);
      top = Math.max(top, point.y);
    }
  }

  return {
    inside:
      centre.front && Math.abs(centre.x) <= 1 && Math.abs(centre.y) <= 1 && Math.abs(centre.z) <= 1,
    left: Math.max(left, -1),
    right: Math.min(right, 1),
    bottom: Math.max(bottom, -1),
    top: Math.min(top, 1),
  };
};

/**
 * One shadow texel's width in world units, for an orthographic shadow camera. From its projection
 * matrix, which is what draws: changing `left` and `right` does nothing until
 * `updateProjectionMatrix()`.
 */
const texelOf = ({ shadow }: ShadowLight) =>
  2 / shadow.camera.projectionMatrix.elements[0]! / shadow.mapSize.width;

/** What a shadow's numbers amount to for one directional or spot light. */
const checkCamera = (
  light: ShadowLight,
  casters: ReturnType<typeof drawnPieces>,
  emptyShare: number,
  player: { view: number[]; x: number; y: number; z: number } | null,
  rows: ShadowIssue[],
) => {
  const { camera } = light.shadow;

  // Works out the camera the way the renderer does each frame, from the light and its target.
  (light.shadow as unknown as { updateMatrices: (light: Light) => void }).updateMatrices(light);

  const matrix = multiply(
    camera.projectionMatrix.elements,
    camera.matrixWorldInverse.elements,
    Array.from({ length: 16 }, () => 0),
  );
  const views = casters.map((piece) => ({ piece, view: inView(matrix, piece.box) }));
  const distance = ({ box }: (typeof casters)[number]) =>
    player
      ? Math.hypot(
          (box[0] + box[3]) / 2 - player.x,
          (box[1] + box[4]) / 2 - player.y,
          (box[2] + box[5]) / 2 - player.z,
        )
      : 0;
  const reach = player
    ? Math.max(0, ...views.filter(({ view }) => view.inside).map(({ piece }) => distance(piece)))
    : Infinity;
  const outside = views.filter(({ piece, view }) => {
    if (view.inside) {
      return false;
    }

    if (!player) {
      return true;
    }

    const seen = inView(player.view, piece.box);

    return seen.left < seen.right && seen.bottom < seen.top && distance(piece) < reach;
  });
  const name = labelOf(light);

  if (outside.length > 0) {
    const named = [...new Set(outside.map(({ piece }) => meshName(piece.mesh)))].slice(0, 3);

    rows.push(
      issue(
        name,
        "casters-outside",
        player
          ? `${outside.length} of ${casters.length} casters are in view and outside its shadow camera, though nearer than ones it covers, so their shadows are missing (${named.join(", ")}). Move or grow the camera.`
          : `${outside.length} of ${casters.length} casters are outside its shadow camera, so they cast nothing (${named.join(", ")}). Move or grow the camera, or turn castShadow off on them. If it follows the player on purpose, pass the player's camera.`,
        light,
      ),
    );

    return;
  }

  let left = Infinity;
  let right = -Infinity;
  let bottom = Infinity;
  let top = -Infinity;

  for (const { view } of views) {
    left = Math.min(left, view.left);
    right = Math.max(right, view.right);
    bottom = Math.min(bottom, view.bottom);
    top = Math.max(top, view.top);
  }

  const used = ((right - left) * (top - bottom)) / 4;

  if (light.isDirectionalLight === true && used < 1 - emptyShare) {
    const texel = texelOf(light);

    rows.push(
      issue(
        name,
        "camera-too-big",
        `casters fill ${Math.round(used * 100)}% of its shadow camera, so shadows are soft for no reason: a texel is ${texel.toPrecision(2)} wide. Fit the camera to what casts.`,
        light,
      ),
    );
  }
};

const checkBias = (
  light: ShadowLight,
  renderer: SetupRenderer | undefined,
  rows: ShadowIssue[],
) => {
  const { shadow } = light;
  const name = labelOf(light);

  if (renderer?.shadowMap?.type === VSM) {
    return;
  }

  if (shadow.bias === 0 && shadow.normalBias === 0) {
    rows.push(
      issue(
        name,
        "no-bias",
        "bias and normalBias are both 0, which draws shadow acne on faces toward the light. Start at normalBias 0.02.",
        light,
      ),
    );

    return;
  }

  if (light.isDirectionalLight !== true) {
    return;
  }

  const { camera } = shadow;
  const texel = texelOf(light);
  const lift =
    Math.abs(shadow.bias) * ((camera.far ?? 0) - (camera.near ?? 0)) + Math.abs(shadow.normalBias);

  if (texel > 0 && lift > texel * BIG_BIAS_TEXELS) {
    rows.push(
      issue(
        name,
        "bias-too-big",
        `bias lifts shadows ${lift.toPrecision(2)} off what casts them, ${Math.round(lift / texel)} shadow texels, so they detach. Lower it.`,
        light,
      ),
    );
  }
};

/** Shadow setups that draw wrong, in no particular order. `[]` is a pass. */
export const findShadowIssues = (
  scene: AnyObject3D,
  options: ShadowOptions = {},
): ShadowIssue[] => {
  const root = asObject3D(scene);
  const { renderer, camera, skip } = options;
  const rows: ShadowIssue[] = [];
  const lights: ShadowLight[] = [];
  const casting: ShadowLight[] = [];
  const casterMeshes: Mesh[] = [];
  let receivers = 0;

  root.updateWorldMatrix(true, true);

  // What's drawn, so a bake's merged meshes and not the parts it hid.
  walk(root, { skip, visibleOnly: true, bakes: "merged" }, (object) => {
    if ((object as Light).isLight === true) {
      lights.push(object as ShadowLight);

      if (object.castShadow) {
        casting.push(object as ShadowLight);
      }
    } else if (isMesh(object)) {
      if (object.castShadow && drawsWhereStored(object)) {
        casterMeshes.push(object);
      }

      if (object.receiveShadow) {
        receivers += 1;
      }
    }
  });

  if (renderer?.shadowMap?.type === REMOVED_MAP_TYPE && renderer.shadowMap.enabled) {
    rows.push(
      issue(
        "renderer",
        "removed-map-type",
        "shadowMap.type is PCFSoftShadowMap, which three removed and replaces with PCFShadowMap, so shadows look harder than meant. Set PCFShadowMap and soften with light.shadow.radius.",
      ),
    );
  }

  if (casting.length > 0 && renderer?.shadowMap && !renderer.shadowMap.enabled) {
    rows.push(
      issue(
        "renderer",
        "shadows-off",
        `shadowMap.enabled is false, but ${casting.length} ${casting.length === 1 ? "light casts" : "lights cast"} shadows. Turn it on (R3F: <Canvas shadows>), or turn castShadow off.`,
      ),
    );
  }

  if (lights.length > 0 && casting.length === 0 && casterMeshes.length > 0) {
    rows.push(
      issue(
        "scene",
        "no-shadow-light",
        `${casterMeshes.length} ${casterMeshes.length === 1 ? "mesh casts" : "meshes cast"} shadows, but no light has castShadow.`,
      ),
    );
  }

  const casters = drawnPieces(root, casterMeshes, "studioObject");
  const player = camera
    ? {
        view: viewProjection(camera),
        x: camera.matrixWorld.elements[12]!,
        y: camera.matrixWorld.elements[13]!,
        z: camera.matrixWorld.elements[14]!,
      }
    : null;

  for (const light of casting) {
    const name = labelOf(light);

    if (casters.length === 0) {
      rows.push(
        issue(
          name,
          "no-casters",
          "it casts shadows, but nothing visible has castShadow, so its shadow map is wasted.",
          light,
        ),
      );
      continue;
    }

    if (receivers === 0) {
      rows.push(
        issue(
          name,
          "no-receivers",
          "it casts shadows, but nothing visible has receiveShadow, so they fall on nothing.",
          light,
        ),
      );
      continue;
    }

    if (light.isDirectionalLight === true || light.isSpotLight === true) {
      checkCamera(light, casters, options.emptyShare ?? 0.75, player, rows);
    }

    checkBias(light, renderer, rows);
  }

  return rows;
};
