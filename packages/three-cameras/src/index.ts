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
  CameraPatch,
  Projection,
  RendererLike,
  SavedView,
  TimelineState,
  TrackStore,
  ViewStore,
} from "./core/lab.ts";
export { applyEase, EASES, sampleTrack, sortKeys } from "./core/track.ts";
export type { Ease, Keyframe } from "./core/track.ts";
export { applyPose, blendPoses, capturePose, easeInOut, poseToCode } from "./core/pose.ts";
export type { Pose } from "./core/pose.ts";
