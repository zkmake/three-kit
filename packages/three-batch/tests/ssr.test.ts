/**
 * Every entry must import under Node with no `window` / `document`: the geometry work runs in
 * tests and build scripts, and an SSR page can import the package at module scope.
 */
import { expect, test } from "vitest";

test("imports without a DOM", async () => {
  expect(typeof window).toBe("undefined");

  const core = await import("../src/index.ts");
  const lod = await import("../src/lod/index.ts");
  const react = await import("../src/react/index.ts");

  expect(typeof core.chunkInstances).toBe("function");
  expect(typeof lod.simplify).toBe("function");
  expect(typeof react.Baked).toBe("function");
});
