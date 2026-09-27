/**
 * Stutter statistics over a window of frame intervals. Average FPS hides a
 * hitch every few seconds; these don't. Stalls (hidden tab, breakpoint) never
 * reach the window, so they don't count as hitches.
 */
import type { FrameStats } from "./types.ts";

/** A frame over this multiple of the window's median interval is a hitch. */
const HITCH_FACTOR = 2;

/** Fewer frames than this and the refresh rate reads `null`. */
const REFRESH_MIN_FRAMES = 60;

/** Common display refresh rates. A reading within 4% of one snaps to it. */
const REFRESH_RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 240, 360];

const EMPTY: FrameStats = Object.freeze({
  frames: 0,
  hitches: 0,
  lowFps: 0,
  p99Ms: 0,
  refreshHz: null,
});

/**
 * The rate the loop runs at when it keeps up: the fastest tenth of frames,
 * not the average, so slow frames don't drag it down. That is the display's
 * refresh rate, or the app's own cap if it throttles itself.
 *
 * Intervals are averaged with their neighbour first. A frame that starts late
 * leaves a short interval after it, and on a real 120 Hz display those short
 * ones alone read as 125–127 Hz; each pair averages back to the vsync.
 */
const refreshFrom = (intervals: readonly number[]): number | null => {
  if (intervals.length < REFRESH_MIN_FRAMES) {
    return null;
  }

  const pairs = intervals.slice(1).map((interval, index) => (interval + intervals[index]!) / 2);
  pairs.sort((a, b) => a - b);
  const rate = 1000 / pairs[Math.floor(pairs.length * 0.1)]!;
  const nearest = REFRESH_RATES.reduce((best, candidate) =>
    Math.abs(candidate - rate) < Math.abs(best - rate) ? candidate : best,
  );

  return Math.abs(nearest - rate) / nearest <= 0.04 ? nearest : Math.round(rate);
};

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

  return Object.freeze({
    frames,
    hitches,
    lowFps: 1000 / (slowSum / slowest),
    p99Ms,
    refreshHz: refreshFrom(intervals),
  });
};

export { computeFrameStats, HITCH_FACTOR };
