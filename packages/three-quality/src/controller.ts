/**
 * The controller: frame times in, a level out. Pure (no DOM, no clock of its own), so it runs the
 * same in a test as in the page. Level 0 is the best rung of the ladder, `levels - 1` the cheapest.
 *
 * Frames are judged a window at a time (`windowMs`) on the window's 90th-percentile frame, so one
 * hitch never counts. A window is slow when that frame is over the budget (`1000 / targetFps`) by
 * more than `slowAt`; a slow window steps one level down. The next window checks the step paid: if
 * the mean frame didn't drop by `minGain` and isn't on target (slipping just under the slow line
 * doesn't count), the frame isn't bound by the
 * pixels (it's the CPU, or the scene), so the step is undone and the controller stops lowering:
 * `cpu-bound`. One noisy window (a shader compiling mid-check) can fake that verdict, so a slow
 * `cpu-bound` stretch tries lowering again after `RETRY_FACTOR × upAfterMs`, twice as long after
 * each failed retry (up to `maxUpAfterMs`). After `upAfterMs` of windows on target it tries a level up; if that one turns slow
 * within `PROBE_WINDOWS` windows it goes back, and waits twice as long before trying again (up to
 * `maxUpAfterMs`), so it never oscillates.
 *
 * A vsynced frame can't show headroom (it's never shorter than the refresh), so "on target" is all
 * the controller can see; the up probe is how it finds out whether there's room.
 *
 * Nothing counts during `warmupMs` (shaders compiling, textures uploading), nor for `settleMs` after
 * each change (a new pixel ratio reallocates the drawing buffer). A frame longer than `gapMs` (a
 * hidden tab, a breakpoint) starts the window over.
 */

type QualityPhase =
  /** Waiting out `warmupMs` before the first judgement. */
  | "warming"
  /** Just changed level; checking what it did. */
  | "adapting"
  /** On target, or as good as it gets. */
  | "steady"
  /** Lowering didn't make frames faster: held at the lowest level that helped. */
  | "cpu-bound"
  /** Fixed by `pin`: a player's own choice. */
  | "pinned";

type ControllerOptions = {
  /** Rungs on the ladder, at least 1. */
  levels: number;
  /** Where to start. Default 0, the best. */
  level?: number;
  /** The frame rate to hold. Default 60. */
  targetFps?: number;
  /** A window is slow when its p90 frame is over budget by more than this fraction. Default 0.2. */
  slowAt?: number;
  /** One judgement per this much frame time. Default 1000. */
  windowMs?: number;
  /** Frame time ignored at the start. Default 2000. */
  warmupMs?: number;
  /** Frame time ignored after each change. Default 500. */
  settleMs?: number;
  /** A frame longer than this starts the window over. Default 250. */
  gapMs?: number;
  /** Time on target before trying a level up. Default 5000. */
  upAfterMs?: number;
  /** The longest wait before trying up, after failed tries double it. Default 60000. */
  maxUpAfterMs?: number;
  /** How much a step down must cut the mean frame to count. Default 0.1. */
  minGain?: number;
};

type ControllerState = {
  readonly level: number;
  readonly levels: number;
  readonly phase: QualityPhase;
  /** The last window's 90th-percentile frame, ms; `null` before the first. */
  readonly p90Ms: number | null;
  /** The frame rate held to. */
  readonly targetFps: number;
};

type QualityController = {
  readonly state: ControllerState;
  /** One frame's duration in ms. Returns the new level when it changes, otherwise `null`. */
  add: (frameMs: number) => number | null;
  /** Hold one level (`null` resumes adapting from it). Returns the level. */
  pin: (level: number | null) => number;
  /**
   * The ladder changed length (a resize), and `level` is the current setting's place on it.
   * Clears what was learned about the old ladder.
   */
  reset: (levels: number, level: number) => void;
};

/** An up step that turns slow within this many windows goes back. */
const PROBE_WINDOWS = 3;
/** A `cpu-bound` verdict is retried after this many `upAfterMs` of slow windows. */
const RETRY_FACTOR = 3;

const clampLevel = (level: number, levels: number) =>
  Math.min(Math.max(0, Math.round(level)), Math.max(0, levels - 1));

const p90Of = (frames: readonly number[]) => {
  const sorted = frames.toSorted((a, b) => a - b);

  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] ?? 0;
};

const meanOf = (frames: readonly number[]) =>
  frames.reduce((sum, frame) => sum + frame, 0) / Math.max(1, frames.length);

const createQualityController = (options: ControllerOptions): QualityController => {
  const targetFps = options.targetFps ?? 60;
  const budgetMs = 1000 / targetFps;
  const slowAt = options.slowAt ?? 0.2;
  const slowMs = budgetMs * (1 + slowAt);
  // Halfway to slow still counts as on target: vsync jitter puts p90 a little past the budget.
  const onTargetMs = budgetMs * (1 + slowAt / 2);
  const windowMs = options.windowMs ?? 1000;
  const settleMs = options.settleMs ?? 500;
  const gapMs = options.gapMs ?? 250;
  const baseUpAfterMs = options.upAfterMs ?? 5000;
  const maxUpAfterMs = options.maxUpAfterMs ?? 60_000;
  const minGain = options.minGain ?? 0.1;

  let levels = Math.max(1, Math.round(options.levels));
  let level = clampLevel(options.level ?? 0, levels);
  let phase: QualityPhase = "warming";
  let p90Ms: number | null = null;
  let state: ControllerState = { level, levels, phase, p90Ms, targetFps };

  /** Frame time still to skip: the warmup, then each settle. */
  let skipMs = options.warmupMs ?? 2000;
  let frames: number[] = [];
  let framesMs = 0;
  /** The lowest level that still helped: lowering stops here once a step down didn't. */
  let floor = levels - 1;
  let onTargetForMs = 0;
  let upAfterMs = baseUpAfterMs;
  /** Slow time spent held at the floor, and how much of it before lowering is tried again. */
  let boundForMs = 0;
  let retryAfterMs = baseUpAfterMs * RETRY_FACTOR;
  /** Lowering past a `cpu-bound` verdict, to see if it still holds. */
  let retrying = false;
  let pinned = false;
  /** Set after a step down: the level it came from and that window's mean frame. */
  let verify: { from: number; meanMs: number } | null = null;
  /** Set after a step up: the level it came from and the windows left to prove it. */
  let probe: { from: number; windows: number } | null = null;

  const publish = () => {
    state = { level, levels, phase, p90Ms, targetFps };
  };

  const startWindow = () => {
    frames = [];
    framesMs = 0;
  };

  const moveTo = (next: number, nextPhase: QualityPhase) => {
    level = next;
    phase = nextPhase;
    skipMs = settleMs;
    onTargetForMs = 0;
    startWindow();
    publish();

    return level;
  };

  const judge = (): number | null => {
    const p90 = p90Of(frames);
    const mean = meanOf(frames);
    const slow = p90 > slowMs;
    const onTarget = p90 <= onTargetMs;
    p90Ms = p90;
    startWindow();

    if (pinned) {
      publish();

      return null;
    }

    if (verify) {
      const { from, meanMs } = verify;
      verify = null;

      const held = retrying;
      retrying = false;

      if (!onTarget && mean > meanMs * (1 - minGain)) {
        // The verdict held: twice as long before the next retry.
        if (held) {
          retryAfterMs = Math.min(retryAfterMs * 2, maxUpAfterMs);
        }

        floor = from;
        boundForMs = 0;

        return moveTo(from, "cpu-bound");
      }
    }

    if (probe) {
      if (slow) {
        const { from } = probe;
        probe = null;
        upAfterMs = Math.min(upAfterMs * 2, maxUpAfterMs);

        return moveTo(from, "steady");
      }

      probe.windows -= 1;

      if (probe.windows <= 0) {
        probe = null;
      }
    }

    if (slow) {
      onTargetForMs = 0;

      if (level >= floor && floor < levels - 1) {
        boundForMs += windowMs;

        if (boundForMs >= retryAfterMs) {
          boundForMs = 0;
          floor = levels - 1;
          retrying = true;
        }
      }

      if (level < floor) {
        verify = { from: level, meanMs: mean };

        return moveTo(level + 1, "adapting");
      }

      phase = floor < levels - 1 ? "cpu-bound" : "steady";
      publish();

      return null;
    }

    if (onTarget) {
      onTargetForMs += windowMs;

      if (level > 0 && onTargetForMs >= upAfterMs) {
        probe = { from: level, windows: PROBE_WINDOWS };
        // Above the floor again: what was learned below it may no longer hold.
        floor = levels - 1;

        return moveTo(level - 1, "adapting");
      }
    } else {
      onTargetForMs = 0;
    }

    if (phase !== "cpu-bound") {
      phase = "steady";
    }

    publish();

    return null;
  };

  return {
    get state() {
      return state;
    },
    add(frameMs) {
      if (!(frameMs > 0) || frameMs > gapMs) {
        startWindow();

        return null;
      }

      if (skipMs > 0) {
        skipMs -= frameMs;

        return null;
      }

      frames.push(frameMs);
      framesMs += frameMs;

      return framesMs >= windowMs ? judge() : null;
    },
    pin(next) {
      verify = null;
      probe = null;
      onTargetForMs = 0;
      startWindow();

      if (next === null) {
        pinned = false;
        phase = "steady";
      } else {
        pinned = true;
        level = clampLevel(next, levels);
        phase = "pinned";
      }

      publish();

      return level;
    },
    reset(nextLevels, nextLevel) {
      levels = Math.max(1, Math.round(nextLevels));
      level = clampLevel(nextLevel, levels);
      floor = levels - 1;
      verify = null;
      probe = null;
      onTargetForMs = 0;
      upAfterMs = baseUpAfterMs;
      boundForMs = 0;
      retryAfterMs = baseUpAfterMs * RETRY_FACTOR;
      retrying = false;
      skipMs = settleMs;
      startWindow();
      publish();
    },
  };
};

export { createQualityController };
export type { ControllerOptions, ControllerState, QualityController, QualityPhase };
