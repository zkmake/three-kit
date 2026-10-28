/**
 * One budgets file per app: what a frame may cost, and what each part of the scene may. The
 * matchers in `@zkmake/three-audit/vitest`, the `three-audit --budgets` CLI and three-meter's HUD
 * all read it, so the numbers live in one place.
 */
import { type AnyObject3D, type Skip } from "./scene.ts";
import { countDraws, countTriangles, listMeshes } from "./triangles.ts";

/** What one frame may cost, all parts together. */
export type FrameBudget = {
  /** The frame rate to hold: three-meter's `targetFps`. */
  fps?: number | undefined;
  /** Draw calls a frame makes. */
  calls?: number | undefined;
  triangles?: number | undefined;
  /** Texture memory in MB. No reader checks it yet; kept for a perf bench. */
  textureMB?: number | undefined;
};

/** What one part (a model, a prop, a kart) may cost. */
export type PartBudget = {
  triangles?: number | undefined;
  /** Draw calls one main pass makes for it: see `countDraws`. */
  draws?: number | undefined;
  /** Visible meshes in it. */
  meshes?: number | undefined;
};

export type BudgetsInput<Part extends string = string> = {
  frame: FrameBudget;
  parts?: Record<Part, PartBudget>;
};

/** `defineBudgets`'s result: frozen, every part named in its type. */
export type Budgets<Part extends string = string> = {
  readonly frame: Readonly<FrameBudget>;
  readonly parts: { readonly [Name in Part]: Readonly<PartBudget> };
};

const FRAME_KEYS = ["fps", "calls", "triangles", "textureMB"] as const;
const PART_KEYS = ["triangles", "draws", "meshes"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A copy of `value` with only `keys`, each a number ≥ 0, frozen. Throws naming `where`. */
const limits = <Key extends string>(value: unknown, keys: readonly Key[], where: string) => {
  if (!isRecord(value)) {
    throw new TypeError(`three-audit: budgets ${where} must be an object`);
  }

  const out: Partial<Record<Key, number>> = {};

  for (const [key, limit] of Object.entries(value)) {
    if (!keys.includes(key as Key)) {
      throw new TypeError(
        `three-audit: budgets ${where} has "${key}"; expected ${keys.map((name) => `"${name}"`).join(", ")}`,
      );
    }

    if (limit === undefined) {
      continue;
    }

    if (typeof limit !== "number" || !(limit >= 0) || !Number.isFinite(limit)) {
      throw new TypeError(`three-audit: budgets ${where}.${key} must be a number ≥ 0`);
    }

    out[key as Key] = limit;
  }

  return Object.freeze(out);
};

/**
 * Checks budgets read from anywhere (a JSON file, a module) and returns them frozen. Throws a
 * `TypeError` naming the first bad key.
 */
export const parseBudgets = (value: unknown): Budgets => {
  if (!isRecord(value)) {
    throw new TypeError("three-audit: budgets must be an object with `frame` and `parts`");
  }

  const parts: Record<string, Readonly<PartBudget>> = {};

  if (value.parts !== undefined) {
    if (!isRecord(value.parts)) {
      throw new TypeError("three-audit: budgets parts must be an object of part budgets");
    }

    for (const [name, part] of Object.entries(value.parts)) {
      parts[name] = limits(part, PART_KEYS, `parts.${name}`);
    }
  }

  return Object.freeze({
    frame: limits(value.frame ?? {}, FRAME_KEYS, "frame"),
    parts: Object.freeze(parts),
  });
};

/**
 * The app's budgets, typed and frozen: one file every reader imports.
 *
 *   export default defineBudgets({
 *     frame: { fps: 60, calls: 150, triangles: 250_000 },
 *     parts: { kart: { triangles: 7_500, draws: 12 } },
 *   });
 *
 * `budgets.parts.kart` is typed, and a part not listed is a type error.
 */
export const defineBudgets = <const Part extends string = never>(
  budgets: BudgetsInput<Part>,
): Budgets<Part> => parseBudgets(budgets) as Budgets<Part>;

export type BudgetMetric = "triangles" | "draws" | "meshes";

export type BudgetCheck = {
  metric: BudgetMetric;
  actual: number;
  limit: number;
  over: boolean;
};

/**
 * An object measured against a part budget (or the frame's `triangles` and `calls`), one row per
 * limit the budget sets. Nothing over is a pass.
 */
export const checkBudget = (
  root: AnyObject3D,
  budget: PartBudget | FrameBudget,
  options: { skip?: Skip | undefined } = {},
): BudgetCheck[] => {
  const part = budget as PartBudget & FrameBudget;
  const draws = part.draws ?? part.calls;
  const rows: BudgetCheck[] = [];
  const add = (metric: BudgetMetric, limit: number | undefined, measure: () => number) => {
    if (limit !== undefined) {
      const actual = measure();

      rows.push({ metric, actual, limit, over: actual > limit });
    }
  };

  add("triangles", part.triangles, () => countTriangles(root, options));
  add("draws", draws, () => countDraws(root, options));
  add("meshes", part.meshes, () => listMeshes(root, options).length);

  return rows;
};
