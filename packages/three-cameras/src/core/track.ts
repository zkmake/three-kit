/**
 * A camera's track: keyframes in time, each a pose and the ease into the next. `sampleTrack` gives
 * the pose at any time: the camera travels a smooth curve through the keyed positions
 * (Catmull-Rom), turns by slerp, and its lens (fov, zoom, near, far) goes straight between keys,
 * all paced by the outgoing key's ease. Before the first key it holds the first; after the last,
 * the last.
 *
 * An ease is a preset or a custom cubic Bézier (CSS `cubic-bezier` terms: the curve from (0, 0) to
 * (1, 1) through two handles). A handle may go above 1 or below 0, for overshoot and anticipation.
 */
import { Vector3 } from "three";

import { blendPoses, type Pose } from "./pose.ts";

export type Ease = "linear" | "ease-in-out" | "ease-in" | "ease-out" | "hold" | "custom";

/** A cubic Bézier ease's two handles, `[x1, y1, x2, y2]`; x in 0–1, y free. */
export type Bezier = [number, number, number, number];

export type Keyframe = {
  id: string;
  /** Seconds from the start of the timeline. */
  time: number;
  pose: Pose;
  /** How it moves on to the next key. `hold` stays put until the next key, then jumps. */
  ease: Ease;
  /** The curve, when `ease` is `custom`. */
  bezier?: Bezier;
};

export const EASES: readonly Ease[] = [
  "ease-in-out",
  "linear",
  "ease-in",
  "ease-out",
  "hold",
  "custom",
];

/** The presets as Bézier handles: where a custom curve starts when a preset is reshaped. */
export const PRESET_BEZIERS: Record<Exclude<Ease, "custom" | "hold">, Bezier> = {
  linear: [0.25, 0.25, 0.75, 0.75],
  "ease-in": [0.32, 0, 0.67, 0],
  "ease-out": [0.33, 1, 0.68, 1],
  "ease-in-out": [0.65, 0, 0.35, 1],
};

const bezierAxis = (a: number, b: number, t: number) => {
  const u = 1 - t;

  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
};

const bezierSlope = (a: number, b: number, t: number) => {
  const u = 1 - t;

  return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
};

/** A cubic Bézier ease: progress (y) at time share `x`, solving the curve's x for its parameter. */
export const cubicBezier = ([x1, y1, x2, y2]: Bezier, x: number) => {
  if (x <= 0 || x >= 1) {
    return x <= 0 ? 0 : 1;
  }

  let t = x;

  // Newton's method, which converges in a few steps on these curves; bisection if it stalls.
  for (let i = 0; i < 8; i += 1) {
    const error = bezierAxis(x1, x2, t) - x;
    const slope = bezierSlope(x1, x2, t);

    if (Math.abs(error) < 1e-7) {
      return bezierAxis(y1, y2, t);
    }

    if (Math.abs(slope) < 1e-6) {
      break;
    }

    t -= error / slope;
  }

  let low = 0;
  let high = 1;

  t = x;

  for (let i = 0; i < 40; i += 1) {
    const value = bezierAxis(x1, x2, t);

    if (Math.abs(value - x) < 1e-7) {
      break;
    }

    if (value < x) {
      low = t;
    } else {
      high = t;
    }

    t = (low + high) / 2;
  }

  return bezierAxis(y1, y2, t);
};

const easeFns: Record<Exclude<Ease, "custom">, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": (t) => t * t * t,
  "ease-out": (t) => 1 - Math.pow(1 - t, 3),
  "ease-in-out": (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  hold: () => 0,
};

/** Progress through a segment at time share `t` (0–1). A custom curve may leave 0–1 in between. */
export const applyEase = (ease: Ease, t: number, bezier?: Bezier) => {
  const clamped = Math.min(1, Math.max(0, t));

  if (ease === "custom") {
    return cubicBezier(bezier ?? PRESET_BEZIERS.linear, clamped);
  }

  return easeFns[ease](clamped);
};

export const sortKeys = (keys: readonly Keyframe[]) => [...keys].sort((a, b) => a.time - b.time);

const p0 = new Vector3();
const p1 = new Vector3();
const p2 = new Vector3();
const p3 = new Vector3();
const out = new Vector3();

/** Uniform Catmull-Rom through p1 → p2, with p0 and p3 as the neighbours shaping the bend. */
const catmullRom = (t: number) => {
  const t2 = t * t;
  const t3 = t2 * t;

  return out.set(
    0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 *
      (2 * p1.z +
        (-p0.z + p2.z) * t +
        (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
        (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  );
};

/** The pose at `time` on sorted `keys`, or `null` with no keys. */
export const sampleTrack = (keys: readonly Keyframe[], time: number): Pose | null => {
  const first = keys[0];
  const last = keys.at(-1);

  if (!first || !last) {
    return null;
  }

  if (time <= first.time || keys.length === 1) {
    return first.pose;
  }

  if (time >= last.time) {
    return last.pose;
  }

  let index = 0;

  while (index < keys.length - 2 && keys[index + 1]!.time <= time) {
    index += 1;
  }

  const from = keys[index]!;
  const to = keys[index + 1]!;
  const span = to.time - from.time;
  const t = applyEase(from.ease, span > 0 ? (time - from.time) / span : 1, from.bezier);
  const pose = blendPoses(from.pose, to.pose, t);

  // The path bends through the neighbours; a held segment doesn't travel at all.
  if (from.ease !== "hold") {
    const before = keys[index - 1];
    const after = keys[index + 2];

    p1.fromArray(from.pose.position);
    p2.fromArray(to.pose.position);

    // A missing neighbour continues the line, so an end segment (or a two-key move) runs straight.
    if (before) {
      p0.fromArray(before.pose.position);
    } else {
      p0.copy(p1).multiplyScalar(2).sub(p2);
    }

    if (after) {
      p3.fromArray(after.pose.position);
    } else {
      p3.copy(p2).multiplyScalar(2).sub(p1);
    }

    const point = catmullRom(t);

    pose.position = [point.x, point.y, point.z];
  }

  return pose;
};
