import { describe, expect, test, vi } from "vitest";

import { adaptQuality, type AdaptQualityOptions } from "./adapt-quality.ts";
import type { QualityStorage } from "./memory.ts";

const VSYNC = 1000 / 60;

const fakeRenderer = () => {
  const ratios: number[] = [];

  return {
    domElement: { clientHeight: 600, clientWidth: 800 },
    ratios,
    setPixelRatio: (value: number) => ratios.push(value),
  };
};

const memoryStorage = (): QualityStorage & { items: Map<string, string> } => {
  const items = new Map<string, string>();

  return {
    getItem: (key) => items.get(key) ?? null,
    items,
    setItem: (key, value) => void items.set(key, value),
  };
};

/** A 1.5× display, the frame fill-rate bound: 30 ms at 1.5×, 22 at 1.25×, the refresh below. */
const setup = (options: AdaptQualityOptions = {}) => {
  const renderer = fakeRenderer();
  // The tests that read it back pass their own memory storage, or none.
  const storage = (options.storage ?? memoryStorage()) as ReturnType<typeof memoryStorage>;
  const quality = adaptQuality(renderer, {
    devicePixelRatio: () => 1.5,
    measure: "manual",
    storage,
    ...options,
  });
  const frameAt = (dpr: number) => (dpr > 1.25 ? 30 : dpr > 1 ? 22 : VSYNC);

  const run = (durationMs: number, frameFor = frameAt) => {
    for (let elapsed = 0; elapsed < durationMs;) {
      const frameMs = frameFor(quality.dpr);
      elapsed += frameMs;
      quality.update(frameMs);
    }
  };

  return { quality, renderer, run, storage };
};

describe("adaptQuality", () => {
  test("starts at the ceiling: the display's ratio within the pixel budget", () => {
    const { quality, renderer } = setup();

    expect(renderer.ratios).toEqual([1.5]);
    expect(quality.state).toMatchObject({ dpr: 1.5, level: 0, levels: 3, phase: "warming" });
  });

  test("steps the pixel ratio down until frames make the target", () => {
    const { quality, renderer, run } = setup();
    run(8000);

    expect(renderer.ratios).toEqual([1.5, 1.25, 1]);
    expect(quality.state).toMatchObject({ dpr: 1, phase: "steady" });
  });

  test("turns tiers off in order once the ratio bottoms out", () => {
    const shadows = vi.fn();
    const { quality, run } = setup({ tiers: [{ name: "shadows", set: shadows }, "bloom"] });

    // Each step pays, and only with both tiers off is the frame on target.
    run(15_000, (dpr) => {
      const { bloom, shadows: shadowsOn } = quality.state.tiers;

      if (!bloom) {
        return VSYNC;
      }

      return shadowsOn ? { 1: 25, 1.25: 30, 1.5: 36 }[dpr]! : 21;
    });

    expect(shadows).toHaveBeenCalledExactlyOnceWith(false);
    expect(quality.state.tiers).toEqual({ bloom: false, shadows: false });
    expect(quality.state).toMatchObject({ dpr: 1, level: 4 });
  });

  test("tells listeners about each change, with a new state object", () => {
    const { quality, run } = setup();
    const seen: number[] = [];
    const first = quality.state;
    quality.onChange((state) => seen.push(state.dpr));
    run(8000);

    expect(quality.state).not.toBe(first);
    expect(seen).toContain(1.25);
    expect(seen.at(-1)).toBe(1);
  });

  test("remembers the settled setting, and the next visit starts there", () => {
    const { run, storage } = setup();
    run(8000);

    expect(JSON.parse(storage.items.get("three-quality")!)).toEqual({
      dpr: 1,
      pinned: false,
      tiersOff: 0,
    });

    const next = setup({ storage });
    expect(next.renderer.ratios).toEqual([1]);
    expect(next.quality.state).toMatchObject({ dpr: 1, level: 2 });
  });

  test("a pin holds and is remembered; unpinning hands back to the controller", () => {
    const { quality, run, storage } = setup();
    quality.pin(2);
    run(10_000, () => 40);

    expect(quality.state).toMatchObject({ dpr: 1, phase: "pinned" });
    expect(JSON.parse(storage.items.get("three-quality")!)).toMatchObject({ pinned: true });
    expect(setup({ storage }).quality.state.phase).toBe("pinned");

    quality.pin(null);
    expect(quality.state.phase).toBe("steady");
    expect(JSON.parse(storage.items.get("three-quality")!)).toMatchObject({ pinned: false });
  });

  test("rebuilds the ladder when the canvas grows, keeping the setting where it fits", () => {
    let size = { height: 600, width: 800 };
    const { quality, renderer } = setup({ devicePixelRatio: () => 2, size: () => size });

    expect(quality.state).toMatchObject({ dpr: 1.85, levels: 5 });

    // 1600 × 1000 at 1.85× is past the pixel budget: the ceiling drops to 1.02.
    size = { height: 1000, width: 1600 };
    quality.refresh();

    expect(quality.state).toMatchObject({ dpr: 1.02, level: 0, levels: 2 });
    expect(renderer.ratios).toEqual([1.85, 1.02]);
  });

  test("runs without storage, and with storage that throws", () => {
    const throwing: QualityStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };

    expect(() => setup({ storage: throwing }).run(8000)).not.toThrow();
    expect(() => setup({ storageKey: null }).run(8000)).not.toThrow();
  });
});
