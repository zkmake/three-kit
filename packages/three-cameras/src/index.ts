/**
 * `@zkmake/three-cameras`: the cameras in a three.js scene and the ones drawing it. Which exist,
 * which are live and how often they draw, where each is and how it projects, and frustum helpers.
 *
 * No UI here: the panel is `./ui`, the React Three Fiber component `./react`.
 */

export { findCameras, isCamera, isCubeCamera, kindOf, pathOf } from "./core/discover.ts";
export type { CameraKind, SceneCamera } from "./core/discover.ts";
export { CameraLab } from "./core/lab.ts";
export type {
  CameraDetails,
  CameraEntry,
  CameraInfo,
  CameraLabOptions,
  Projection,
  RendererLike,
} from "./core/lab.ts";
