import { type RootState, useStore } from "@react-three/fiber";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { StrictMode, useEffect } from "react";
import { describe, expect, test } from "vitest";

import {
  AdaptiveQuality,
  createQualityStore,
  useAdaptiveQuality,
  useQualityTier,
} from "./index.ts";

// Tells React the renderer drives act() itself.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Readings = { r3f?: () => RootState; shadows?: boolean; dpr?: number | null };

/** Reports what the scene's components would read: R3F's state, the tier, the controller's ratio. */
function Reader({
  onRead,
  store,
}: {
  onRead: (readings: Readings) => void;
  store: ReturnType<typeof createQualityStore>;
}) {
  const r3f = useStore();
  const shadows = useQualityTier("shadows", store);
  const dpr = useAdaptiveQuality(store)?.dpr ?? null;

  useEffect(() => {
    onRead({ dpr, r3f: r3f.getState, shadows });
  });

  return null;
}

/** A 1.5× display, 800 × 600 canvas. */
const mount = async () => {
  const store = createQualityStore();
  const readings: Readings = {};
  const renderer = await ReactThreeTestRenderer.create(
    <StrictMode>
      <AdaptiveQuality
        devicePixelRatio={() => 1.5}
        storageKey={null}
        store={store}
        tiers={["shadows"]}
      />
      <Reader onRead={(next) => Object.assign(readings, next)} store={store} />
    </StrictMode>,
    { height: 600, width: 800 },
  );

  /** `durationMs` of frames `frameMs` long. */
  const frames = (frameMs: number, durationMs: number) =>
    ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(Math.ceil(durationMs / frameMs), frameMs / 1000);
    });

  return { frames, readings, renderer, store };
};

describe("<AdaptiveQuality>", () => {
  test("sets the Canvas's ratio and publishes the controller", async () => {
    const { readings, renderer, store } = await mount();

    expect(readings.r3f!().viewport.dpr).toBe(1.5);
    expect(store.get()?.state).toMatchObject({ dpr: 1.5, levels: 4, phase: "warming" });
    expect(readings).toMatchObject({ dpr: 1.5, shadows: true });

    await renderer.unmount();
    expect(store.get()).toBeNull();
  });

  test("steps down from useFrame's delta, and the hooks follow", async () => {
    const { frames, readings, renderer } = await mount();
    // The warmup, then one slow window: a step down, which the next frames show paid.
    await frames(40, 3000);
    await frames(30, 1500);

    expect(readings.r3f!().viewport.dpr).toBe(1.25);
    expect(readings.dpr).toBe(1.25);

    await renderer.unmount();
  });

  test("puts its ratio back when R3F re-applies the Canvas's dpr prop", async () => {
    const { readings, renderer } = await mount();
    readings.r3f!().setDpr(2);

    expect(readings.r3f!().viewport.dpr).toBe(1.5);

    await renderer.unmount();
  });
});
