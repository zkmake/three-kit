/**
 * Budgets: the value each metric should stay within. A reading past its
 * budget turns amber in the card, and the FPS / CPU / GPU graphs draw the
 * line once the series reaches it. `fps`, `low` and `headroom` are floors
 * (worse below); everything else is a ceiling (worse above).
 *
 * Timing budgets default from `targetFps`: FPS at least 95% of it, 1% low at
 * least half, CPU and GPU within one frame, p99 within one and a half,
 * headroom at least zero. Without a `targetFps`, the detected refresh rate is
 * used, then 60 until one is detected.
 * Counts have no default, since what's reasonable depends on the scene. Pass
 * `null` for a key to drop its default, or `false` for no budgets at all.
 *
 * An app's budgets file (`AppBudgets`, from three-audit's `defineBudgets`) works too: its
 * `frame` sets `targetFps`, `calls` and `triangles`.
 */
type BudgetKey =
  | "calls"
  | "cpu"
  | "fps"
  | "geometries"
  | "gpu"
  | "headroom"
  | "hitches"
  | "lines"
  | "low"
  | "p99"
  | "passes"
  | "points"
  | "refresh"
  | "shaders"
  | "textures"
  | "triangles";

type Budgets = Partial<Record<BudgetKey, number | null>> & {
  /** The frame rate the defaults are derived from. Default: the detected refresh rate, else 60. */
  targetFps?: number;
};

/**
 * An app's budgets file, as `@zkmake/three-audit`'s `defineBudgets` returns it. Structural, so
 * three-meter needs no dependency: only `frame` is read, its `fps` as `targetFps`.
 */
type AppBudgets = {
  readonly frame: {
    readonly fps?: number | undefined;
    readonly calls?: number | undefined;
    readonly triangles?: number | undefined;
  };
};

/** What the HUD's `budgets` option takes: its own budgets, or an app's budgets file. */
type BudgetsInput = Budgets | AppBudgets;

type ResolvedBudgets = {
  /** Frame budget in ms, `1000 / targetFps`. */
  frameMs: number;
  /** The rate the timing budgets came from: `targetFps`, the detected refresh, or 60. */
  targetFps: number;
  limits: Partial<Record<BudgetKey, number>>;
};

const DEFAULT_TARGET_FPS = 60;
const FLOORS = new Set<BudgetKey>(["fps", "headroom", "low"]);

const isAppBudgets = (budgets: BudgetsInput): budgets is AppBudgets => "frame" in budgets;

/** An app's frame budget as the HUD's: only the limits it sets, so the rest keep their defaults. */
const fromApp = ({ frame }: AppBudgets): Budgets => {
  const budgets: Budgets = {};

  if (frame.fps !== undefined) {
    budgets.targetFps = frame.fps;
  }

  if (frame.calls !== undefined) {
    budgets.calls = frame.calls;
  }

  if (frame.triangles !== undefined) {
    budgets.triangles = frame.triangles;
  }

  return budgets;
};

/** `detectedHz` is the monitor's refresh reading; an explicit `targetFps` wins over it. */
const resolveBudgets = (
  input: BudgetsInput | false | undefined,
  detectedHz: number | null = null,
): ResolvedBudgets => {
  const budgets = input && isAppBudgets(input) ? fromApp(input) : input;
  const targetFps = (budgets && budgets.targetFps) || detectedHz || DEFAULT_TARGET_FPS;
  const frameMs = 1000 / targetFps;

  if (budgets === false) {
    return { frameMs, limits: {}, targetFps };
  }

  const merged: Budgets = {
    cpu: frameMs,
    fps: targetFps * 0.95,
    gpu: frameMs,
    headroom: 0,
    low: targetFps / 2,
    p99: frameMs * 1.5,
    ...budgets,
  };
  const limits: Partial<Record<BudgetKey, number>> = {};

  for (const [key, limit] of Object.entries(merged)) {
    if (key !== "targetFps" && typeof limit === "number" && Number.isFinite(limit)) {
      limits[key as BudgetKey] = limit;
    }
  }

  return { frameMs, limits, targetFps };
};

const isFloor = (key: BudgetKey) => FLOORS.has(key);

/** `null` means the value isn't known yet (no frames, no GPU timer), which is never over. */
const isOverBudget = (resolved: ResolvedBudgets, key: BudgetKey, value: number | null) => {
  const limit = resolved.limits[key];

  if (limit === undefined || value === null) {
    return false;
  }

  return isFloor(key) ? value < limit : value > limit;
};

export { isFloor, isOverBudget, resolveBudgets };
export type { AppBudgets, BudgetKey, Budgets, BudgetsInput, ResolvedBudgets };
