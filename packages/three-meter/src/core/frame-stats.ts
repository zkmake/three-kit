/**
 * Stutter statistics over a window of frame intervals. Average FPS hides a
 * hitch every few seconds; these don't. Stalls (hidden tab, breakpoint) never
 * reach the window, so they don't count as hitches.
 */
import type { FrameStats } from "./types.ts";

/** A frame over this multiple of the window's median interval is a hitch. */
const HITCH_FACTOR = 2;

const EMPTY: FrameStats = Object.freeze({ frames: 0, hitches: 0, lowFps: 0, p99Ms: 0 });

const computeFrameStats = (intervals: readonly number[]): FrameStats => {
  const frames = intervals.length;

  if (frames === 0) {
    return EMPTY;
  }

  const sorted = [...intervals].sort((a, b) => a - b);
  // Nearest rank: the smallest interval at or above 99% of frames.
  const p99Ms = sorted[Math.ceil(frames * 0.99) - 1]!;

  // 1% low: the mean rate across the slowest 1% of frames (at least one frame).
  const slowest = Math.max(1, Math.ceil(frames * 0.01));
  let slowSum = 0;

  for (let index = frames - slowest; index < frames; index += 1) {
    slowSum += sorted[index]!;
  }

  const middle = frames >> 1;
  const median = frames % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
  const threshold = median * HITCH_FACTOR;
  let hitches = 0;

  for (const interval of intervals) {
    if (interval > threshold) {
      hitches += 1;
    }
  }

  return Object.freeze({ frames, hitches, lowFps: 1000 / (slowSum / slowest), p99Ms });
};

export { computeFrameStats, HITCH_FACTOR };
