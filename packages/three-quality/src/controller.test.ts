import { describe, expect, test } from "vitest";

import { createQualityController, type QualityController } from "./controller.ts";

const VSYNC = 1000 / 60;

/**
 * Feeds `durationMs` of frames, each as long as `frameFor` says at the current level. Returns the
 * level changes in order, each with the frame time fed until it.
 */
const timeline = (
  controller: QualityController,
  frameFor: (level: number) => number,
  durationMs: number,
) => {
  const changes: { at: number; level: number }[] = [];

  for (let elapsed = 0; elapsed < durationMs;) {
    const frameMs = frameFor(controller.state.level);
    elapsed += frameMs;
    const changed = controller.add(frameMs);

    if (changed !== null) {
      changes.push({ at: elapsed, level: changed });
    }
  }

  return changes;
};

/** The level changes alone. */
const drive = (...args: Parameters<typeof timeline>) =>
  timeline(...args).map((change) => change.level);

/** A fill-rate-bound frame: each level down is cheaper, level 2 makes the refresh. */
const gpuBound = (level: number) => [30, 22, VSYNC, VSYNC][level]!;

describe("createQualityController", () => {
  test("judges nothing while warming up", () => {
    const controller = createQualityController({ levels: 4 });

    expect(drive(controller, () => 40, 1900)).toEqual([]);
    expect(controller.state).toMatchObject({ level: 0, p90Ms: null, phase: "warming" });
  });

  test("holds the best level while frames make the target", () => {
    const controller = createQualityController({ levels: 4 });

    expect(drive(controller, () => VSYNC, 20_000)).toEqual([]);
    expect(controller.state.phase).toBe("steady");
    expect(controller.state.p90Ms).toBeCloseTo(VSYNC);
  });

  test("steps down until frames make the target", () => {
    const controller = createQualityController({ levels: 4 });

    // Warmup, then a window and a settle per step: two steps take 2 + 1 + 1.5 + 1.5 s.
    expect(drive(controller, gpuBound, 6500)).toEqual([1, 2]);
    expect(controller.state).toMatchObject({ level: 2, phase: "steady" });
  });

  test("tries a level up after time on target, goes back if it's slow, and waits longer", () => {
    const controller = createQualityController({ levels: 4 });
    const [, settled, up, back, upAgain, backAgain] = timeline(controller, gpuBound, 30_000);

    expect([settled, up, back, upAgain, backAgain].map((change) => change?.level)).toEqual([
      2, 1, 2, 1, 2,
    ]);
    // A settle, then five on-target windows; after the failed try, ten. A window ends on the frame
    // that fills it, so each runs a little over.
    expect(up!.at - settled!.at).toBeGreaterThanOrEqual(5500);
    expect(up!.at - settled!.at).toBeLessThan(5700);
    expect(upAgain!.at - back!.at).toBeGreaterThanOrEqual(10_500);
    expect(upAgain!.at - back!.at).toBeLessThan(10_800);
  });

  test("keeps a level up that holds the target", () => {
    const controller = createQualityController({ levels: 4 });
    let fast = false;
    drive(controller, gpuBound, 6500);
    // The scene got lighter: every level makes the refresh now.
    fast = true;

    expect(drive(controller, (level) => (fast ? VSYNC : gpuBound(level)), 15_000)).toEqual([1, 0]);
    expect(controller.state.level).toBe(0);
  });

  test("undoes a step down that didn't speed frames up, and stops lowering", () => {
    const controller = createQualityController({ levels: 4 });

    // CPU-bound: 30 ms whatever the pixel ratio.
    expect(drive(controller, () => 30, 5000)).toEqual([1, 0]);
    expect(controller.state).toMatchObject({ level: 0, phase: "cpu-bound" });
    expect(drive(controller, () => 30, 20_000)).toEqual([]);
  });

  test("ignores one hitch in a window, and starts over after a gap", () => {
    const controller = createQualityController({ levels: 4 });
    drive(controller, () => VSYNC, 3000);

    let frame = 0;
    // A 120 ms shader compile in every second of frames.
    expect(drive(controller, () => (++frame % 60 === 0 ? 120 : VSYNC), 5000)).toEqual([]);
    // A hidden tab: one 2 s frame, never judged.
    expect(controller.add(2000)).toBeNull();
    expect(controller.state.level).toBe(0);
  });

  test("a pinned level holds whatever the frames, until unpinned", () => {
    const controller = createQualityController({ levels: 4 });

    expect(controller.pin(3)).toBe(3);
    expect(drive(controller, () => VSYNC, 20_000)).toEqual([]);
    expect(controller.state).toMatchObject({ level: 3, phase: "pinned" });

    controller.pin(0);
    expect(drive(controller, () => 30, 5000)).toEqual([]);

    controller.pin(null);
    expect(controller.state.phase).toBe("steady");
    expect(drive(controller, gpuBound, 4000)).toEqual([1, 2]);
  });

  test("starts at a given level and clamps to the ladder", () => {
    expect(createQualityController({ level: 2, levels: 4 }).state.level).toBe(2);
    expect(createQualityController({ level: 9, levels: 4 }).state.level).toBe(3);

    const controller = createQualityController({ level: 3, levels: 4 });
    controller.reset(2, 5);
    expect(controller.state).toMatchObject({ level: 1, levels: 2 });
  });

  test("never lowers past the last level", () => {
    const controller = createQualityController({ levels: 2 });

    expect(drive(controller, (level) => [40, 30][level]!, 10_000)).toEqual([1]);
    expect(controller.state).toMatchObject({ level: 1, phase: "steady" });
  });

  test("holds a different frame rate", () => {
    const controller = createQualityController({ levels: 3, targetFps: 30 });

    expect(drive(controller, () => 30, 10_000)).toEqual([]);
    expect(controller.state.targetFps).toBe(30);
  });
});
