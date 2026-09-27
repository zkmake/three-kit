import { afterEach, describe, expect, test, vi } from "vitest";

import { PerformanceMonitor } from "./performance-monitor.ts";
import type { PerfRenderer } from "./types.ts";

type FakeRenderer = PerfRenderer & { renders: number };

const fakeWebgl = (): FakeRenderer => {
  const renderer: FakeRenderer = {
    info: {
      autoReset: true,
      memory: { geometries: 3, textures: 2 },
      programs: { length: 4 },
      render: { calls: 11, lines: 1, points: 0, triangles: 900 },
      reset: () => {
        renderer.info.render.calls = 0;
      },
    },
    render: () => {
      renderer.renders += 1;
      renderer.info.render.calls = 11;
    },
    renders: 0,
  };

  return renderer;
};

const fakeWebgpu = (): PerfRenderer => ({
  backend: { trackTimestamp: false },
  info: {
    autoReset: true,
    memory: { geometries: 1, programs: 9, textures: 1 },
    render: { calls: 0, drawCalls: 7, lines: 0, points: 0, triangles: 10 },
    reset: () => {},
  },
  render: () => {},
});

/** Drive `performance.now()` by hand: each call returns the next value in the script. */
const scriptClock = (times: number[]) => {
  const queue = [...times];
  vi.spyOn(performance, "now").mockImplementation(() => {
    if (queue.length === 0) {
      throw new Error("scriptClock ran out of times");
    }

    return queue.shift()!;
  });
};

describe("PerformanceMonitor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("CPU runs from begin to the return of the last render, not to end()", () => {
    const renderer = fakeWebgl();
    const monitor = new PerformanceMonitor({ renderer, trackGPU: false });

    // begin=0, render returns at 3 and 5, end() reached at 16.7 (next tick).
    scriptClock([0, 3, 5, 16.7]);
    monitor.begin();
    renderer.render();
    renderer.render();
    monitor.end();

    expect(monitor.getSample().cpu).toBeCloseTo(5);
    monitor.dispose();
  });

  test("CPU falls back to end() when the frame did not render", () => {
    const monitor = new PerformanceMonitor({ renderer: fakeWebgl(), trackGPU: false });

    scriptClock([100, 104]);
    monitor.begin();
    monitor.end();

    expect(monitor.getSample().cpu).toBeCloseTo(4);
    monitor.dispose();
  });

  test("FPS follows the tick interval and ignores stalls over a second", () => {
    const monitor = new PerformanceMonitor({ renderer: fakeWebgl(), trackGPU: false });

    // Two 16 ms frames, then a 5 s gap (hidden tab), then a 16 ms frame.
    scriptClock([0, 0, 16, 16, 32, 32, 5032, 5032, 5048, 5048]);

    for (let index = 0; index < 5; index += 1) {
      monitor.begin();
      monitor.end();
    }

    const fps = monitor.getHistory("fps");
    expect(fps[1]).toBeCloseTo(62.5);
    expect(fps[2]).toBeCloseTo(62.5);
    // The stall frame repeats the previous reading instead of logging ~0.2 fps.
    expect(fps[3]).toBeCloseTo(62.5);
    expect(fps[4]).toBeCloseTo(62.5);
    expect(monitor.getSample().fps).toBeGreaterThan(30);
    monitor.dispose();
  });

  test("counts render passes between begin and end, and reads WebGL fields", () => {
    const renderer = fakeWebgl();
    const monitor = new PerformanceMonitor({ renderer, trackGPU: false });

    expect(renderer.info.autoReset).toBe(false);

    monitor.begin();
    renderer.render();
    renderer.render();
    monitor.end();

    const sample = monitor.getSample();
    expect(sample.render.passes).toBe(2);
    expect(sample.render.calls).toBe(11);
    expect(sample.resources.programs).toBe(4);
    expect(sample.gpu.available).toBe(false);
    expect(renderer.renders).toBe(2);

    monitor.dispose();
  });

  test("prefers WebGPU drawCalls and memory.programs when present", () => {
    const monitor = new PerformanceMonitor({ renderer: fakeWebgpu(), trackGPU: false });
    monitor.begin();
    monitor.end();

    expect(monitor.getSample().render.calls).toBe(7);
    expect(monitor.getSample().resources.programs).toBe(9);
    monitor.dispose();
  });

  test("dispose restores render and autoReset, and frees the renderer", () => {
    const renderer = fakeWebgl();
    const original = renderer.render;
    const monitor = new PerformanceMonitor({ renderer, trackGPU: false });

    expect(renderer.render).not.toBe(original);
    monitor.dispose();

    expect(renderer.render).toBe(original);
    expect(renderer.info.autoReset).toBe(true);
    expect(() => new PerformanceMonitor({ renderer, trackGPU: false }).dispose()).not.toThrow();
  });

  test("refuses a second monitor on the same renderer", () => {
    const renderer = fakeWebgl();
    const monitor = new PerformanceMonitor({ renderer, trackGPU: false });

    expect(() => new PerformanceMonitor({ renderer, trackGPU: false })).toThrow(/already attached/);
    monitor.dispose();
  });

  test("keeps a bounded history per metric", () => {
    const monitor = new PerformanceMonitor({
      historySize: 3,
      renderer: fakeWebgl(),
      trackGPU: false,
    });

    for (let index = 0; index < 5; index += 1) {
      monitor.begin();
      monitor.end();
    }

    expect(monitor.getHistory("cpu")).toHaveLength(3);
    monitor.dispose();
  });

  test("frame stats window skips stalls, stays bounded, and caches until the next frame", () => {
    const monitor = new PerformanceMonitor({
      frameStatsSize: 3,
      renderer: fakeWebgl(),
      trackGPU: false,
    });

    // begin() reads the clock once, end() once. Intervals: 10, 20, stall, 30, 40.
    scriptClock([0, 0, 10, 10, 30, 30, 5030, 5030, 5060, 5060, 5100, 5100]);

    for (let index = 0; index < 6; index += 1) {
      monitor.begin();
      monitor.end();
    }

    const stats = monitor.getFrameStats();
    expect(stats.frames).toBe(3);
    expect(stats.p99Ms).toBe(40);
    expect(monitor.getFrameStats()).toBe(stats);
    monitor.dispose();
  });
});
