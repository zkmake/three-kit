/**
 * A pose as separate channels, the way a graph editor shows it: position x, y, z; rotation x, y, z
 * (XYZ Euler, degrees); and the lens (fov, zoom, near, far). Read one, or write one back into a
 * pose. Rotation is stored as a quaternion, so a rotation channel goes through Euler angles on the
 * way in and out.
 */
import { Euler, Quaternion } from "three";

import type { Pose } from "./pose.ts";
import { type Keyframe, sampleTrack } from "./track.ts";

export type Channel = "px" | "py" | "pz" | "rx" | "ry" | "rz" | "fov" | "zoom" | "near" | "far";

export const CHANNELS: readonly Channel[] = [
  "px",
  "py",
  "pz",
  "rx",
  "ry",
  "rz",
  "fov",
  "zoom",
  "near",
  "far",
];

export const CHANNEL_LABELS: Record<Channel, string> = {
  px: "position x",
  py: "position y",
  pz: "position z",
  rx: "rotation x",
  ry: "rotation y",
  rz: "rotation z",
  fov: "fov",
  zoom: "zoom",
  near: "near",
  far: "far",
};

const euler = new Euler();
const quaternion = new Quaternion();
const DEGREES = 180 / Math.PI;

/** One channel's value in a pose; `undefined` for fov on an orthographic pose. */
export const readChannel = (pose: Pose, channel: Channel): number | undefined => {
  switch (channel) {
    case "px":
      return pose.position[0];
    case "py":
      return pose.position[1];
    case "pz":
      return pose.position[2];
    case "rx":
    case "ry":
    case "rz": {
      euler.setFromQuaternion(quaternion.fromArray(pose.quaternion));

      return (channel === "rx" ? euler.x : channel === "ry" ? euler.y : euler.z) * DEGREES;
    }
    default:
      return pose[channel];
  }
};

/** A copy of `pose` with one channel set. */
export const writeChannel = (pose: Pose, channel: Channel, value: number): Pose => {
  const next: Pose = {
    ...pose,
    position: [...pose.position],
    quaternion: [...pose.quaternion],
  };

  switch (channel) {
    case "px":
    case "py":
    case "pz":
      next.position[channel === "px" ? 0 : channel === "py" ? 1 : 2] = value;
      break;
    case "rx":
    case "ry":
    case "rz": {
      euler.setFromQuaternion(quaternion.fromArray(pose.quaternion));
      euler[channel === "rx" ? "x" : channel === "ry" ? "y" : "z"] = value / DEGREES;
      quaternion.setFromEuler(euler);
      next.quaternion = [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
      break;
    }
    default:
      next[channel] = value;
  }

  return next;
};

/**
 * A channel over time, `samples + 1` points from `start` to `end`, as the track plays it. Angles
 * are unwrapped (no jump at ±180°) so a turn reads as one curve.
 */
export const sampleChannel = (
  keys: readonly Keyframe[],
  channel: Channel,
  start: number,
  end: number,
  samples: number,
): [number, number][] => {
  const points: [number, number][] = [];
  let previous: number | undefined;

  for (let i = 0; i <= samples; i += 1) {
    const time = start + ((end - start) * i) / samples;
    const pose = sampleTrack(keys, time);
    let value = pose ? readChannel(pose, channel) : undefined;

    if (value === undefined) {
      continue;
    }

    if (previous !== undefined && channel.startsWith("r")) {
      while (value - previous > 180) {
        value -= 360;
      }

      while (value - previous < -180) {
        value += 360;
      }
    }

    previous = value;
    points.push([time, value]);
  }

  return points;
};
