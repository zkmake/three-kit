import { describe, expect, test } from "vitest";

import { buildLadder, levelOf, pixelRatioCeiling } from "./ladder.ts";

describe("pixelRatioCeiling", () => {
  test("is the display's ratio when the canvas fits the pixel budget", () => {
    expect(pixelRatioCeiling(800, 600, 1.5)).toBe(1.5);
    expect(pixelRatioCeiling(800, 600, 1)).toBe(1);
  });

  test("caps a retina display at maxDpr", () => {
    expect(pixelRatioCeiling(400, 300, 3)).toBe(2);
    expect(pixelRatioCeiling(400, 300, 3, { maxDpr: 1.5 })).toBe(1.5);
  });

  test("keeps a big canvas within maxPixels, never below minDpr", () => {
    // 1440 × 900 at 2× would be 5.2M pixels; the budget allows ≈1.13×.
    expect(pixelRatioCeiling(1440, 900, 2)).toBe(1.13);
    expect(pixelRatioCeiling(3840, 2160, 2)).toBe(1);
    expect(pixelRatioCeiling(3840, 2160, 2, { minDpr: 0.75 })).toBe(0.75);
  });
});

describe("buildLadder", () => {
  test("steps the ratio down on a grid from the ceiling to minDpr", () => {
    expect(buildLadder({ ceiling: 2 }).map((rung) => rung.dpr)).toEqual([2, 1.75, 1.5, 1.25, 1]);
    expect(buildLadder({ ceiling: 1.4 }).map((rung) => rung.dpr)).toEqual([1.4, 1.25, 1]);
    expect(buildLadder({ ceiling: 1.13, minDpr: 0.75 }).map((rung) => rung.dpr)).toEqual([
      1.13, 1, 0.75,
    ]);
  });

  test("is one rung when there's nothing to step", () => {
    expect(buildLadder({ ceiling: 1 })).toEqual([{ dpr: 1, tiersOff: 0 }]);
  });

  test("turns tiers off after the ratio bottoms out, or before with tiersFirst", () => {
    expect(buildLadder({ ceiling: 1.5, tiers: 2 })).toEqual([
      { dpr: 1.5, tiersOff: 0 },
      { dpr: 1.25, tiersOff: 0 },
      { dpr: 1, tiersOff: 0 },
      { dpr: 1, tiersOff: 1 },
      { dpr: 1, tiersOff: 2 },
    ]);
    expect(buildLadder({ ceiling: 1.5, tiers: 2, tiersFirst: true })).toEqual([
      { dpr: 1.5, tiersOff: 0 },
      { dpr: 1.5, tiersOff: 1 },
      { dpr: 1.5, tiersOff: 2 },
      { dpr: 1.25, tiersOff: 2 },
      { dpr: 1, tiersOff: 2 },
    ]);
  });
});

describe("levelOf", () => {
  const ladder = buildLadder({ ceiling: 1.5, tiers: 1 });

  test("finds the best rung no better than a setting", () => {
    expect(levelOf(ladder, { dpr: 1.5, tiersOff: 0 })).toBe(0);
    expect(levelOf(ladder, { dpr: 1.3, tiersOff: 0 })).toBe(1);
    expect(levelOf(ladder, { dpr: 2, tiersOff: 1 })).toBe(3);
  });

  test("is the last rung for a setting below the ladder", () => {
    expect(levelOf(ladder, { dpr: 0.5, tiersOff: 0 })).toBe(3);
  });
});
