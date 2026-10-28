/**
 * Every entry must import under Node with no `window` / `document`, so a Next / Remix page can
 * import the package at module scope and only start adapting inside an effect. Vitest's default
 * environment here is node.
 */
import { describe, expect, test } from "vitest";

describe("server-side import", () => {
  test("has no window or document", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  test("core entry imports, and adapts without a window", async () => {
    const core = await import("../src/index.ts");
    const quality = core.adaptQuality(null, { storageKey: null });

    expect(quality.state.dpr).toBe(1);
    quality.dispose();
  });

  test("react entry imports", async () => {
    const react = await import("../src/react/index.ts");

    expect(typeof react.AdaptiveQuality).toBe("function");
    expect(react.qualityStore.state).toBeNull();
  });
});
