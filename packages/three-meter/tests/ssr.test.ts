/**
 * Every entry must import under Node with no `window` / `document`, so a
 * Next / Remix page can import the package at module scope and only touch the
 * DOM inside an effect. Vitest's default environment here is node.
 */
import { describe, expect, test } from "vitest";

describe("server-side import", () => {
  test("has no window or document", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  test("core entry imports", async () => {
    const core = await import("../src/index.ts");
    expect(typeof core.PerformanceMonitor).toBe("function");
  });

  test("ui entry imports", async () => {
    const ui = await import("../src/ui/index.ts");
    expect(typeof ui.mountPerfHud).toBe("function");
    expect(ui.PERF_HUD_STYLES).toContain(".perf-monitor");
  });

  test("react entry imports", async () => {
    const react = await import("../src/react/index.ts");
    expect(typeof react.PerfSampler).toBe("function");
    expect(typeof react.PerfHud).toBe("function");
  });
});
