/**
 * Every entry must import under Node with no `window` / `document`: an SSR page imports the
 * package at module scope and mounts the panel in an effect.
 */
import { expect, test } from "vitest";

test("imports without a DOM", async () => {
  expect(typeof window).toBe("undefined");

  const core = await import("../src/index.ts");
  const ui = await import("../src/ui/index.ts");
  const react = await import("../src/react/index.tsx");

  expect(typeof core.TextureLab).toBe("function");
  expect(core.TextureLab.canLink).toBe(false);
  expect(typeof ui.mountTexturePanel).toBe("function");
  expect(typeof react.TexturePanel).toBe("function");
});
