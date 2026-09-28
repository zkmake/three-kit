/**
 * Find the cameras under a scene, and tell them apart. A `CubeCamera` is one entry (its six face
 * cameras are its own business); an `ArrayCamera`'s sub-cameras aren't children, so they never show.
 */
import type { Camera, Object3D, OrthographicCamera, PerspectiveCamera } from "three";

export type CameraKind = "perspective" | "orthographic" | "array" | "cube" | "other";

/** A camera, or a `CubeCamera`, which is an `Object3D` holding six. */
export type SceneCamera = Camera | Object3D;

export const isCubeCamera = (object: Object3D) => object.type === "CubeCamera";

export const isCamera = (object: Object3D): object is Camera =>
  (object as Camera).isCamera === true;

export const kindOf = (camera: SceneCamera): CameraKind => {
  if (isCubeCamera(camera)) {
    return "cube";
  }

  // An ArrayCamera is a PerspectiveCamera too: check it first.
  if ((camera as { isArrayCamera?: boolean }).isArrayCamera) {
    return "array";
  }

  if ((camera as PerspectiveCamera).isPerspectiveCamera) {
    return "perspective";
  }

  if ((camera as OrthographicCamera).isOrthographicCamera) {
    return "orthographic";
  }

  return "other";
};

/** Every camera under `root`, in scene order, `root` included. */
export const findCameras = (root: Object3D): SceneCamera[] => {
  const found: SceneCamera[] = [];

  const visit = (object: Object3D) => {
    if (isCubeCamera(object)) {
      found.push(object);

      return;
    }

    if (isCamera(object)) {
      found.push(object);
    }

    for (const child of object.children) {
      visit(child);
    }
  };

  visit(root);

  return found;
};

/** Where it sits: its ancestors' names (or types) from the root down, `scene › rig › cam`. */
export const pathOf = (object: Object3D): string[] => {
  const path: string[] = [];

  for (let node: Object3D | null = object.parent; node; node = node.parent) {
    path.unshift(node.name || node.type);
  }

  return path;
};
