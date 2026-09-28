/**
 * A camera's track: keyframes in time, each a pose and the ease into the next. `sampleTrack` gives
 * the pose at any time: the camera travels a smooth curve through the keyed positions
 * (Catmull-Rom), turns by slerp, and its lens (fov, zoom, near, far) goes straight between keys,
 * all paced by the outgoing key's ease. Before the first key it holds the first; after the last,
 * the last.
 */
import { Vector3 } from "three";

import { blendPoses, type Pose } from "./pose.ts";

export type Ease = "linear" | "ease-in-out" | "ease-in" | "ease-out" | "hold";

export type Keyframe = {
  id: string;
  /** Seconds from the start of the timeline. */
  time: number;
  pose: Pose;
  /** How it moves on to the next key. `hold` stays put until the next key, then jumps. */
  ease: Ease;
};

export const EASES: readonly Ease[] = ["ease-in-out", "linear", "ease-in", "ease-out", "hold"];

const easeFns: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": (t) => t * t * t,
  "ease-out": (t) => 1 - Math.pow(1 - t, 3),
  "ease-in-out": (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  hold: () => 0,
};

export const applyEase = (ease: Ease, t: number) => easeFns[ease](Math.min(1, Math.max(0, t)));

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
  const t = applyEase(from.ease, span > 0 ? (time - from.time) / span : 1);
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
