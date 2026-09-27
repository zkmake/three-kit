import { describe, expect, test } from "vitest";

import { computeFrameStats } from "./frame-stats.ts";

describe("computeFrameStats", () => {
  test("empty window reads zeros", () => {
    expect(computeFrameStats([])).toEqual({ frames: 0, hitches: 0, lowFps: 0, p99Ms: 0 });
  });

  test("steady 60 Hz has no hitches and a 1% low of 60", () => {
    const stats = computeFrameStats(Array.from({ length: 200 }, () => 1000 / 60));

    expect(stats.frames).toBe(200);
    expect(stats.hitches).toBe(0);
    expect(stats.lowFps).toBeCloseTo(60);
    expect(stats.p99Ms).toBeCloseTo(16.67, 1);
  });

  test("a few long frames show in the 1% low, p99 and hitches, not the median", () => {
    // 197 frames at 10 ms, then 30, 50 and 70 ms.
    const intervals = [...Array.from({ length: 197 }, () => 10), 30, 50, 70];
    const stats = computeFrameStats(intervals);

    // Slowest 1% of 200 frames is 2 frames: 50 and 70 ms, mean 60 ms.
    expect(stats.lowFps).toBeCloseTo(1000 / 60);
    // Nearest rank 198 of 200.
    expect(stats.p99Ms).toBe(30);
    // Over twice the 10 ms median.
    expect(stats.hitches).toBe(3);
  });

  test("a single frame is its own 1% low", () => {
    expect(computeFrameStats([25])).toMatchObject({ frames: 1, hitches: 0, lowFps: 40, p99Ms: 25 });
  });
});
