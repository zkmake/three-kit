import { describe, expect, test } from "vitest";

import { formatQuality, qualityTitle } from "./quality.ts";

describe("formatQuality", () => {
  test("reads the ratio, the phase and the tiers that are off", () => {
    expect(formatQuality({ dpr: 1.25, level: 1, levels: 4, phase: "adapting" })).toBe(
      "dpr 1.25 · adapting",
    );
    expect(
      formatQuality({
        dpr: 1,
        level: 4,
        levels: 5,
        phase: "steady",
        tiers: { bloom: false, shadows: false, water: true },
      }),
    ).toBe("dpr 1 · steady · bloom, shadows off");
  });

  test("is a dash with no controller", () => {
    expect(formatQuality(null)).toBe("—");
  });
});

describe("qualityTitle", () => {
  test("names the level and the last window against the budget", () => {
    expect(
      qualityTitle({ dpr: 1, level: 2, levels: 3, p90Ms: 18.24, phase: "steady", targetFps: 60 }),
    ).toBe("Adaptive quality: level 3 of 3 (1 is the best); p90 frame 18.2 ms against 16.7 ms.");
  });
});
