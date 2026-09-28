/**
 * A camera's pose: where it is, which way it faces, and how it projects. Poses are what saved
 * views hold now and what keyframes will: capture one, put one back, and blend between two.
 *
 * Position and rotation are the camera's own (local, relative to its parent), so a pose put back
 * lands where it was taken even if the parent has moved since, the same way a keyframe would.
 */
import { Quaternion, Vector3 } from "three";
import type { Camera, OrthographicCamera, PerspectiveCamera } from "three";

export type Pose = {
  position: [number, number, number];
  /** x, y, z, w. */
  quaternion: [number, number, number, number];
  near: number;
  far: number;
  zoom: number;
  /** Perspective cameras only. */
  fov?: number;
};

type Projecting = PerspectiveCamera | OrthographicCamera;

const isPerspective = (camera: Camera): camera is PerspectiveCamera =>
  (camera as PerspectiveCamera).isPerspectiveCamera === true;

const projects = (camera: Camera): camera is Projecting =>
  isPerspective(camera) || (camera as OrthographicCamera).isOrthographicCamera === true;

export const capturePose = (camera: Camera): Pose => {
  const { position, quaternion } = camera;
  const pose: Pose = {
    position: [position.x, position.y, position.z],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    near: 0,
    far: 0,
    zoom: 1,
  };

  if (projects(camera)) {
    pose.near = camera.near;
    pose.far = camera.far;
    pose.zoom = camera.zoom;
  }

  if (isPerspective(camera)) {
    pose.fov = camera.fov;
  }

  return pose;
};

export const applyPose = (camera: Camera, pose: Pose) => {
  camera.position.fromArray(pose.position);
  camera.quaternion.fromArray(pose.quaternion);

  if (projects(camera)) {
    camera.near = pose.near;
    camera.far = pose.far;
    camera.zoom = pose.zoom;

    if (isPerspective(camera) && pose.fov !== undefined) {
      camera.fov = pose.fov;
    }

    camera.updateProjectionMatrix();
  }
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const from = new Quaternion();
const to = new Quaternion();
const va = new Vector3();
const vb = new Vector3();

/** The pose `t` of the way from `a` to `b`: positions and lenses straight, rotation by slerp. */
export const blendPoses = (a: Pose, b: Pose, t: number): Pose => {
  const position = va.fromArray(a.position).lerp(vb.fromArray(b.position), t);
  const quaternion = from.fromArray(a.quaternion).slerp(to.fromArray(b.quaternion), t);
  const pose: Pose = {
    position: [position.x, position.y, position.z],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    near: lerp(a.near, b.near, t),
    far: lerp(a.far, b.far, t),
    zoom: lerp(a.zoom, b.zoom, t),
  };

  if (a.fov !== undefined && b.fov !== undefined) {
    pose.fov = lerp(a.fov, b.fov, t);
  }

  return pose;
};

/** Slow in, slow out: a camera move that starts and settles gently. */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const round = (value: number, digits = 4) => {
  const text = value.toFixed(digits);

  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
};

/** Three.js to recreate the pose on a camera called `name`. */
export const poseToCode = (pose: Pose, name = "camera") => {
  const [x, y, z, w] = pose.quaternion;
  const lines = [
    `${name}.position.set(${pose.position.map((value) => round(value)).join(", ")});`,
    `${name}.quaternion.set(${[x, y, z, w].map((value) => round(value, 5)).join(", ")});`,
  ];

  if (pose.fov !== undefined) {
    lines.push(`${name}.fov = ${round(pose.fov, 2)};`);
  }

  if (pose.zoom !== 1) {
    lines.push(`${name}.zoom = ${round(pose.zoom, 3)};`);
  }

  lines.push(`${name}.near = ${round(pose.near)};`, `${name}.far = ${round(pose.far)};`);
  lines.push(`${name}.updateProjectionMatrix();`);

  return lines.join("\n");
};
