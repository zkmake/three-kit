import { describe, expect, test, vi } from "vitest";

import type { PerformanceMonitor } from "./performance-monitor.ts";
import { wrapAnimationLoop } from "./wrap-animation-loop.ts";

describe("wrapAnimationLoop", () => {
  test("brackets each tick: begin, your loop, end", () => {
    const calls: string[] = [];
    const monitor = {
      begin: vi.fn(() => calls.push("begin")),
      end: vi.fn(() => calls.push("end")),
    } as unknown as PerformanceMonitor;
    const loop = vi.fn((time: number) => calls.push(`loop:${time}`));
    const wrapped = wrapAnimationLoop(monitor, loop);

    wrapped(16);
    wrapped(32);

    expect(calls).toEqual(["begin", "loop:16", "end", "begin", "loop:32", "end"]);
  });

  test("still closes the frame when the loop throws", () => {
    const monitor = { begin: vi.fn(), end: vi.fn() } as unknown as PerformanceMonitor;
    const wrapped = wrapAnimationLoop(monitor, () => {
      throw new Error("boom");
    });

    expect(() => wrapped()).toThrow("boom");
    expect(monitor.end).toHaveBeenCalledTimes(1);
  });
});
