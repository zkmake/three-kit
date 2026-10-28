import type { FrameBudget, PartBudget } from "./define-budgets.ts";
/**
 * One budgets file per app: what a frame may cost, and what each part of the scene may. The
 * matchers in `@zkmake/three-audit/vitest`, the `three-audit --budgets` CLI and three-meter's HUD
 * all read it, so the numbers live in one place.
 */
import { type AnyObject3D, type Skip } from "./scene.ts";
import { countDraws, countTriangles, listMeshes } from "./triangles.ts";

export { defineBudgets, parseBudgets } from "./define-budgets.ts";
export type { Budgets, BudgetsInput, FrameBudget, PartBudget } from "./define-budgets.ts";

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
