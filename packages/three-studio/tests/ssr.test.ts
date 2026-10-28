/**
 * Every browser entry must import under Node with no `window` / `document`: an SSR page imports
 * the package at module scope and mounts the studio in an effect.
 */
import { expect, test } from "vitest";

test("imports without a DOM", async () => {
  expect(typeof window).toBe("undefined");

  const core = await import("../src/index.ts");
  const ui = await import("../src/ui/index.ts");
  const react = await import("../src/react/index.tsx");

  expect(typeof core.resolveStudio).toBe("function");
  expect(typeof ui.mountStudio).toBe("function");
  expect(typeof react.Studio).toBe("function");
});
