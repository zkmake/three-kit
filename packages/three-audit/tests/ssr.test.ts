/**
 * The entry must import under Node with no `window` / `document`: the geometry checks run in
 * Vitest and CI, and an SSR page can import the package at module scope.
 */
import { expect, test } from "vitest";

test("imports without a DOM", async () => {
  expect(typeof window).toBe("undefined");

  const audit = await import("../src/index.ts");

  expect(typeof audit.findZFighting).toBe("function");
  expect(typeof audit.installAuditHelpers).toBe("function");
});
