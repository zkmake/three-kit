/**
 * Demo cameras keep their framing on a wide screen and back off on a narrow one: from the authored
 * position, along the same line, out to the distance that shows a sphere around the scene whole
 * at this aspect. A portrait phone sees the whole scene instead of its middle.
 */
import { MathUtils, type PerspectiveCamera, Vector3, type Vector3Tuple } from "three";

type Framing = {
  /** Where the camera stands on a wide screen, and what it looks at. */
  position: Vector3Tuple;
  target: Vector3Tuple;
  /** What it looks at on a portrait screen, when that differs (a scene aimed off-centre). */
  narrowTarget?: Vector3Tuple;
  /** A sphere around the target that must stay in view. */
  radius: number;
};

/** How far from its target a camera must stand to see a sphere of `radius` whole. */
const fitDistance = (camera: PerspectiveCamera, radius: number) => {
  const vertical = MathUtils.degToRad(camera.fov) / 2;
  const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);

  return radius / Math.sin(Math.min(vertical, horizontal));
};

/**
 * Places `camera` for its current aspect and aims it; `target` (an OrbitControls target, say)
 * receives the point it looks at.
 */
const frameCamera = (
  camera: PerspectiveCamera,
  framing: Framing,
  target: Vector3 = new Vector3(),
) => {
  const offset = new Vector3(...framing.position).sub(new Vector3(...framing.target));

  offset.setLength(Math.max(offset.length(), fitDistance(camera, framing.radius)));
  target.set(
    ...(camera.aspect < 1 && framing.narrowTarget ? framing.narrowTarget : framing.target),
  );
  camera.position.copy(target).add(offset);
  camera.lookAt(target);

  return target;
};

export { frameCamera };
export type { Framing };
