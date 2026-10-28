/**
 * Every entry must import under Node with no `window` / `document`, so a Next / Remix page can
 * import the package at module scope. Vitest's default environment here is node.
 */
import { describe, expect, test } from "vitest";

describe("server-side import", () => {
  test("has no window or document", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  test("core entry imports, and stays off without a URL", async () => {
    const core = await import("../src/index.ts");

    expect(core.hasDebugFlag()).toBe(false);
  });

  test("react entry imports", async () => {
    const react = await import("../src/react/index.ts");

    expect(typeof react.DevTools).toBe("function");
  });
});
