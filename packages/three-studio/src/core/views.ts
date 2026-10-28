import type { Camera, Vector3 } from "three";

import type { StudioView, StudioViews, Vec3 } from "./state.ts";

/** What `applyView` moves alongside the camera: OrbitControls and the like. */
export type ViewControls = { target: Vector3; update: () => unknown };

/**
 * Puts the camera at the view and aims it, lens included, and moves the controls' target with it
 * so an orbit starts from there.
 */
export function applyView(camera: Camera, view: StudioView, controls?: ViewControls | null) {
  camera.position.set(...view.position);

  const lens = camera as Camera & {
    isPerspectiveCamera?: boolean;
    fov?: number;
    near?: number;
    far?: number;
    zoom?: number;
    updateProjectionMatrix?: () => void;
  };

  if (lens.isPerspectiveCamera && view.fov !== undefined) {
    lens.fov = view.fov;
  }

  if (view.near !== undefined && lens.near !== undefined) {
    lens.near = view.near;
  }

  if (view.far !== undefined && lens.far !== undefined) {
    lens.far = view.far;
  }

  if (view.zoom !== undefined && lens.zoom !== undefined) {
    lens.zoom = view.zoom;
  }

  lens.updateProjectionMatrix?.();
  camera.lookAt(...view.target);
  camera.updateMatrixWorld();

  if (controls) {
    controls.target.set(...view.target);
    controls.update();
  }
}

export type OrbitViewsOptions = {
  /**
   * The game camera: its offset from what it looks at, and its lens. Gives the `play` view, and
   * the bearing `close` looks along. Copy it from the game's camera code, never by eye.
   */
  play?: { offset: Vec3; fov: number } | undefined;
  /** The lens of every view but `play`. Default 40. */
  fov?: number | undefined;
  /**
   * Where `front` looks from: the direction from the object to a camera facing its front. Default
   * `[1, 0.25, 0]`, for kits whose front is +x; `[0, 0.25, -1]` for one facing -z, like a vehicle
   * driving down -z. `side` is a quarter turn round from it and `back` opposite, at its height.
   */
  front?: Vec3 | undefined;
};

const along = (centre: Vec3, direction: Vec3, distance: number, fov: number): StudioView => {
  const length = Math.hypot(...direction) || 1;

  return {
    position: [
      centre[0] + (direction[0] / length) * distance,
      centre[1] + (direction[1] / length) * distance,
      centre[2] + (direction[2] / length) * distance,
    ],
    target: centre,
    fov,
  };
};

/**
 * The views every studio wants around one object at `centre`: `play` (the game camera's exact
 * bearing, distance and lens, when given), `close` (that bearing, `near` away), and `front`,
 * `side`, `back` and `top` at `near`. Front looks down -x by default (`options.front` turns it).
 */
export function orbitViews(
  centre: Vec3,
  near: number,
  options: OrbitViewsOptions = {},
): StudioViews {
  const fov = options.fov ?? 40;
  const play = options.play;
  const bearing: Vec3 = play ? play.offset : [1, 0.6, 1.2];
  const views: Record<string, StudioView> = {};

  if (play) {
    const [x, y, z] = play.offset;

    views.play = {
      position: [centre[0] + x, centre[1] + y, centre[2] + z],
      target: centre,
      fov: play.fov,
    };
  }

  views.close = along(centre, bearing, near, fov);
  const [fx, fy, fz] = options.front ?? [1, 0.25, 0];

  views.front = along(centre, [fx, fy, fz], near, fov);
  views.side = along(centre, [-fz, fy, fx], near, fov);
  views.back = along(centre, [-fx, fy, -fz], near, fov);
  // Not straight down: lookAt from directly above spins on its up vector.
  views.top = along(centre, [0.001, 1, 0.001], near, fov);

  return views;
}
