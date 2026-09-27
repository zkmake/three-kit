/**
 * Budgets: the value each metric should stay within. A reading past its
 * budget turns amber in the card, and the FPS / CPU / GPU graphs draw the
 * line once the series reaches it. `fps` and `low` are floors (worse below);
 * everything else is a ceiling (worse above).
 *
 * Timing budgets default from `targetFps` (60): FPS at least 95% of it, 1%
 * low at least half, CPU and GPU within one frame, p99 within one and a half.
 * Counts have no default, since what's reasonable depends on the scene. Pass
 * `null` for a key to drop its default, or `false` for no budgets at all.
 */
type BudgetKey =
  | "calls"
  | "cpu"
  | "fps"
  | "geometries"
  | "gpu"
  | "hitches"
  | "lines"
  | "low"
  | "p99"
  | "passes"
  | "points"
  | "shaders"
  | "textures"
  | "triangles";

type Budgets = Partial<Record<BudgetKey, number | null>> & {
  /** The frame rate the defaults are derived from. Default 60. */
  targetFps?: number;
};

type ResolvedBudgets = {
  /** Frame budget in ms, `1000 / targetFps`. */
  frameMs: number;
  limits: Partial<Record<BudgetKey, number>>;
};

const DEFAULT_TARGET_FPS = 60;
const FLOORS = new Set<BudgetKey>(["fps", "low"]);

const resolveBudgets = (budgets: Budgets | false | undefined): ResolvedBudgets => {
  const targetFps = (budgets && budgets.targetFps) || DEFAULT_TARGET_FPS;
  const frameMs = 1000 / targetFps;

  if (budgets === false) {
    return { frameMs, limits: {} };
  }

  const merged: Budgets = {
    cpu: frameMs,
    fps: targetFps * 0.95,
    gpu: frameMs,
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

  return { frameMs, limits };
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
export type { BudgetKey, Budgets, ResolvedBudgets };
