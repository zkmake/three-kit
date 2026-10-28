/**
 * The quality ladder: every setting the controller can pick, best first. Each rung is a pixel ratio
 * and how many of the app's tiers are off. The ratios step down from the ceiling (the display's
 * ratio, capped by `maxDpr` and by a pixel budget for the whole canvas) to `minDpr`; the tiers go
 * off one at a time, in the order given, after the ratios bottom out (or before, `tiersFirst`).
 */

type Rung = {
  /** Device pixels per CSS pixel. */
  readonly dpr: number;
  /** How many tiers are off, from the first: 0 is all on. */
  readonly tiersOff: number;
};

type CeilingOptions = {
  /** Never above this. Default 2. */
  maxDpr?: number;
  /** Never below this. Default 1. */
  minDpr?: number;
  /** The most device pixels the whole canvas may have. Default 1,650,000 (≈1.5× of 1100 × 700). */
  maxPixels?: number;
};

type LadderOptions = CeilingOptions & {
  /** The ceiling: from {@link pixelRatioCeiling}. */
  ceiling: number;
  /** The gap between ratios. Default 0.25. */
  dprStep?: number;
  /** How many tiers the app registered. Default 0. */
  tiers?: number;
  /** Drop the tiers before the pixel ratio. Default false: the ratio first. */
  tiersFirst?: boolean;
};

const DEFAULT_MAX_DPR = 2;
const DEFAULT_MIN_DPR = 1;
const DEFAULT_MAX_PIXELS = 1_650_000;
const DEFAULT_DPR_STEP = 0.25;

/** Two decimals: what a ratio reads as, and what's compared. */
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The highest pixel ratio worth rendering a `width` × `height` (CSS pixels) canvas at: the
 * display's, capped at `maxDpr` and so the canvas stays within `maxPixels` (a big monitor gets a
 * lower ratio than a laptop lid), never below `minDpr`.
 */
const pixelRatioCeiling = (
  width: number,
  height: number,
  devicePixelRatio: number,
  {
    maxDpr = DEFAULT_MAX_DPR,
    minDpr = DEFAULT_MIN_DPR,
    maxPixels = DEFAULT_MAX_PIXELS,
  }: CeilingOptions = {},
) =>
  round(
    Math.max(
      minDpr,
      Math.min(devicePixelRatio, maxDpr, Math.sqrt(maxPixels / Math.max(1, width * height))),
    ),
  );

/**
 * The ratios from the ceiling down: the ceiling, then each multiple of `dprStep` below it down to
 * `minDpr` (1.4 → 1.4, 1.25, 1), then `minDpr` itself if the steps miss it.
 */
const pixelRatios = (ceiling: number, minDpr: number, dprStep: number) => {
  const ratios = [round(ceiling)];
  let next = Math.ceil(round(ceiling / dprStep)) * dprStep - dprStep;

  while (round(next) > round(minDpr)) {
    if (round(next) < ratios.at(-1)!) {
      ratios.push(round(next));
    }

    next -= dprStep;
  }

  if (ratios.at(-1)! > round(minDpr)) {
    ratios.push(round(minDpr));
  }

  return ratios;
};

/** Every rung, best first. Never empty: one rung when there's nothing to step. */
const buildLadder = ({
  ceiling,
  minDpr = DEFAULT_MIN_DPR,
  dprStep = DEFAULT_DPR_STEP,
  tiers = 0,
  tiersFirst = false,
}: LadderOptions): Rung[] => {
  const ratios = pixelRatios(ceiling, Math.min(minDpr, ceiling), dprStep);
  const rungs: Rung[] = [];

  if (tiersFirst) {
    for (let off = 0; off <= tiers; off++) {
      rungs.push({ dpr: ratios[0]!, tiersOff: off });
    }

    for (const dpr of ratios.slice(1)) {
      rungs.push({ dpr, tiersOff: tiers });
    }
  } else {
    for (const dpr of ratios) {
      rungs.push({ dpr, tiersOff: 0 });
    }

    for (let off = 1; off <= tiers; off++) {
      rungs.push({ dpr: ratios.at(-1)!, tiersOff: off });
    }
  }

  return rungs;
};

/**
 * The best rung that's no better than `rung`, on a ladder that may have changed (a resize moved
 * the ceiling, a remembered setting from another visit): its ratio at most `rung.dpr`, at least
 * `rung.tiersOff` tiers off. The last rung if none is that low.
 */
const levelOf = (ladder: readonly Rung[], rung: Rung) => {
  const index = ladder.findIndex(
    (step) => step.dpr <= round(rung.dpr) && step.tiersOff >= rung.tiersOff,
  );

  return index === -1 ? ladder.length - 1 : index;
};

export {
  buildLadder,
  DEFAULT_DPR_STEP,
  DEFAULT_MAX_DPR,
  DEFAULT_MAX_PIXELS,
  DEFAULT_MIN_DPR,
  levelOf,
  pixelRatioCeiling,
};
export type { CeilingOptions, LadderOptions, Rung };
