/**
 * `@zkmake/three-audit/vitest`: the checks as Vitest matchers. Importing this entry registers them
 * (in a test file, or once in a `setupFiles` module):
 *
 *   import "@zkmake/three-audit/vitest";
 *
 *   expect(kart).toFitBudget(budgets.parts.kart);
 *   expect(kart).toHaveNoZFighting();
 *   expect(kart).toHaveCleanGeometry();
 *
 * Failures print what three-audit's CLI does: actual against budget and the costliest meshes,
 * the z-fighting pairs, the bad meshes. Vitest is a peer; the main entry never imports this one.
 */
import { expect } from "vitest";

import { type BadGeometryOptions, findBadGeometry, findEmptyMeshes } from "../bad-geometry.ts";
import { checkBudget, type FrameBudget, type PartBudget } from "../budgets.ts";
import {
  badGeometryLines,
  budgetLines,
  emptyMeshLines,
  meshLines,
  plural,
  zFightingLines,
} from "../report-lines.ts";
import type { AnyObject3D, Skip } from "../scene.ts";
import { listMeshes } from "../triangles.ts";
import { findZFighting, type ZFightingOptions } from "../z-fighting.ts";

export { triangles } from "../triangles.ts";

export type FitBudgetOptions = {
  skip?: Skip | undefined;
  /** How many of the costliest meshes a failure lists. Default 5. */
  top?: number;
};

type Context = {
  isNot: boolean;
  utils: { matcherHint: (name: string, received?: string, expected?: string) => string };
};

const isObject3D = (value: unknown): value is AnyObject3D =>
  typeof value === "object" &&
  value !== null &&
  (value as { isObject3D?: unknown }).isObject3D === true;

const nameOf = (object: AnyObject3D) => {
  const { name, type } = object as { name?: string; type?: string };

  return name ? `"${name}"` : (type ?? "the object");
};

/** Throws, as a matcher must, when what it was handed isn't a three.js object. */
const asRoot = (received: unknown, matcher: string) => {
  if (!isObject3D(received)) {
    throw new TypeError(
      `${matcher}: expected a three.js object (Object3D), got ${typeof received}`,
    );
  }

  return received;
};

const toFitBudget = function (
  this: Context,
  received: unknown,
  budget: PartBudget | FrameBudget,
  options: FitBudgetOptions = {},
) {
  const root = asRoot(received, "toFitBudget");
  const checks = checkBudget(root, budget, { skip: options.skip });

  if (checks.length === 0) {
    throw new TypeError("toFitBudget: the budget sets no triangles, draws (calls) or meshes");
  }

  const over = checks.filter((check) => check.over);
  const top = listMeshes(root, { skip: options.skip }).slice(0, options.top ?? 5);
  const hint = this.utils.matcherHint(".toFitBudget", "object", "budget");

  return {
    pass: over.length === 0,
    actual: Object.fromEntries(checks.map((check) => [check.metric, check.actual])),
    expected: Object.fromEntries(checks.map((check) => [check.metric, check.limit])),
    message: () =>
      [
        hint,
        "",
        this.isNot
          ? `${nameOf(root)} fits its budget, expected it not to:`
          : `${nameOf(root)} is over its budget on ${over.map((check) => check.metric).join(", ")}:`,
        ...budgetLines(checks),
        ...(top.length > 0 ? ["  most triangles:", ...meshLines(top)] : []),
      ].join("\n"),
  };
};

const toHaveNoZFighting = function (
  this: Context,
  received: unknown,
  options: ZFightingOptions = {},
) {
  const root = asRoot(received, "toHaveNoZFighting");
  const rows = findZFighting(root, options);
  const hint = this.utils.matcherHint(".toHaveNoZFighting", "object", "");

  return {
    pass: rows.length === 0,
    message: () =>
      this.isNot
        ? `${hint}\n\n${nameOf(root)} has no z-fighting, expected some`
        : [
            hint,
            "",
            `${nameOf(root)} has ${rows.length} z-fighting ${plural(rows.length, "pair")}:`,
            ...zFightingLines(rows),
          ].join("\n"),
  };
};

const toHaveCleanGeometry = function (
  this: Context,
  received: unknown,
  options: BadGeometryOptions = {},
) {
  const root = asRoot(received, "toHaveCleanGeometry");
  const bad = findBadGeometry(root, options);
  const empty = findEmptyMeshes(root, options);
  const hint = this.utils.matcherHint(".toHaveCleanGeometry", "object", "");

  return {
    pass: bad.length === 0 && empty.length === 0,
    message: () =>
      this.isNot
        ? `${hint}\n\n${nameOf(root)} has clean geometry, expected NaN or empty meshes`
        : [
            hint,
            "",
            ...(bad.length > 0
              ? [
                  `${nameOf(root)} has ${bad.length} ${plural(bad.length, "mesh", "meshes")} with NaN geometry:`,
                  ...badGeometryLines(bad),
                ]
              : []),
            ...(empty.length > 0
              ? [
                  `${nameOf(root)} has ${empty.length} empty ${plural(empty.length, "mesh", "meshes")} (no vertices):`,
                  ...emptyMeshLines(empty),
                ]
              : []),
          ].join("\n"),
  };
};

/** The matchers, for `expect.extend` by hand. */
export const matchers = { toFitBudget, toHaveNoZFighting, toHaveCleanGeometry };

/** Registers the matchers on Vitest's `expect`. Importing this entry already has. */
export const installMatchers = () => {
  expect.extend(matchers);
};

installMatchers();

declare module "vitest" {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    /**
     * The object's triangles, draw calls and meshes are within the budget's: a part of
     * `defineBudgets`'s, or its frame (`calls` counts as `draws`). Fails listing actual against
     * budget and the costliest meshes.
     */
    toFitBudget: (budget: PartBudget | FrameBudget, options?: FitBudgetOptions) => R;
    /** `findZFighting` finds nothing. Fails listing the pairs. */
    toHaveNoZFighting: (options?: ZFightingOptions) => R;
    /** No NaN geometry (`findBadGeometry`) and no empty meshes (`findEmptyMeshes`). */
    toHaveCleanGeometry: (options?: BadGeometryOptions) => R;
  }
}
