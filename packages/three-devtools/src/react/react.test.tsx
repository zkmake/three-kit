import ReactThreeTestRenderer from "@react-three/test-renderer";
import { StrictMode } from "react";
import { describe, expect, test, vi } from "vitest";

import { DevTools } from "./index.ts";

// Tells React the renderer drives act() itself.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const helpers = globalThis as { tris?: () => number };

/** Lets the tools' `import()`s settle. */
const settle = () => vi.waitFor(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe("<DevTools>", () => {
  test("without the flag or dev: nothing installed", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StrictMode>
        <DevTools />
      </StrictMode>,
    );

    await settle();
    expect(helpers.tris).toBeUndefined();
    await renderer.unmount();
  });

  test("dev: the helpers read the canvas's scene, and go with it", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StrictMode>
        <DevTools dev />
        <mesh>
          <boxGeometry />
        </mesh>
      </StrictMode>,
    );

    await vi.waitFor(() => expect(typeof helpers.tris).toBe("function"));
    expect(helpers.tris?.()).toBe(12);

    await renderer.unmount();
    expect(helpers.tris).toBeUndefined();
  });
});
