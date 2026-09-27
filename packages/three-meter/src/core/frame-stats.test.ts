import { describe, expect, test } from "vitest";

import { computeFrameStats } from "./frame-stats.ts";

describe("computeFrameStats", () => {
  test("empty window reads zeros", () => {
    expect(computeFrameStats([])).toEqual({
      frames: 0,
      hitches: 0,
      lowFps: 0,
      p99Ms: 0,
      refreshHz: null,
    });
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

  describe("refreshHz", () => {
    /** `count` frames at `hz`, with a little jitter, plus `slow` frames at a quarter of the rate. */
    const loop = (hz: number, count = 300, slow = 0) => [
      ...Array.from({ length: count }, (_, index) => 1000 / hz + (index % 3) * 0.15 - 0.15),
      ...Array.from({ length: slow }, () => 4000 / hz),
    ];

    test.each([60, 120, 144, 165, 240])("snaps %i Hz", (hz) => {
      expect(computeFrameStats(loop(hz)).refreshHz).toBe(hz);
    });

    test("a late frame followed by an early one doesn't read as a faster display", () => {
      // 120 Hz where begin() lands 1.3 ms late every other frame: 9.6, 7.0, 9.6, 7.0 ms.
      // The short intervals alone read as 143 Hz; paired, they average back to 120.
      const jittered = Array.from({ length: 300 }, (_, index) =>
        index % 2 === 0 ? 1000 / 120 + 1.3 : 1000 / 120 - 1.3,
      );
      expect(computeFrameStats(jittered).refreshHz).toBe(120);
    });

    test("slow frames don't drag it down", () => {
      // A third of the frames take four vsyncs; the fastest tenth still sits at 120 Hz.
      expect(computeFrameStats(loop(120, 200, 100)).refreshHz).toBe(120);
    });

    test("an app capped at 60 on a faster display reads 60", () => {
      expect(computeFrameStats(loop(60)).refreshHz).toBe(60);
    });

    test("a rate between common ones is rounded, not forced to the nearest", () => {
      // Not snapped to 75 or 90; within a hertz of 84 given the jitter.
      expect(computeFrameStats(loop(84)).refreshHz).toBeGreaterThanOrEqual(83);
      expect(computeFrameStats(loop(84)).refreshHz).toBeLessThanOrEqual(85);
    });

    test("too few frames reads null", () => {
      expect(computeFrameStats(loop(60, 59)).refreshHz).toBeNull();
    });
  });
});
