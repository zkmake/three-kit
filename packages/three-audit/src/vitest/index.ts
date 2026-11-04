/**
 * `@zkmake/three-audit/vitest`: the checks as Vitest matchers. Importing this entry registers them
 * (in a test file, or once in a `setupFiles` module):
 *
 *   import "@zkmake/three-audit/vitest";
 *
 *   expect(kart).toFitBudget(budgets.parts.kart);
 *   expect(kart).toHaveNoZFighting();
 *   expect(kart).toHaveCleanGeometry();
 *   expect(city).toHaveNoIntersections({ between: ["trees", "wires"] });
 *   expect(site).toHaveNothingFloating();
 *
 * Failures print what three-audit's CLI does: actual against budget and the costliest meshes,
 * the z-fighting pairs, the bad meshes. Vitest is a peer; the main entry never imports this one.
 */
import { expect } from "vitest";

import { type BadGeometryOptions, findBadGeometry, findEmptyMeshes } from "../bad-geometry.ts";
import { checkBudget, type FrameBudget, type PartBudget } from "../budgets.ts";
import { type ColorOptions, findColorIssues } from "../color-issues.ts";
import { findFloating, type FloatingOptions, findSunk, type SunkOptions } from "../grounding.ts";
import { findIntersections, type IntersectionOptions } from "../intersections.ts";
import {
  badGeometryLines,
  budgetLines,
  emptyMeshLines,
  floatingLines,
  intersectionLines,
  issueLines,
  meshLines,
  plural,
  sunkLines,
  unnamedLines,
  zFightingLines,
} from "../report-lines.ts";
import type { AnyObject3D, Skip } from "../scene.ts";
import { findShadowIssues, type ShadowOptions } from "../shadow-issues.ts";
import { listMeshes } from "../triangles.ts";
import { findUnnamedMeshes, type UnnamedOptions } from "../unnamed-meshes.ts";
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
    throw new TypeError(
      "toFitBudget: the budget sets no triangles, draws (calls), meshes or textureMB",
    );
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

/** A matcher that passes when a check finds nothing, and fails listing what it found. */
const noneFound = <Options, Row>(
  matcher: string,
  find: (root: AnyObject3D, options: Options) => readonly Row[],
  passed: string,
  failed: (n: number) => string,
  lines: (rows: readonly Row[]) => string[],
) =>
  function (this: Context, received: unknown, options: Options = {} as Options) {
    const root = asRoot(received, matcher);
    const rows = find(root, options);
    const hint = this.utils.matcherHint(`.${matcher}`, "object", "");

    return {
      pass: rows.length === 0,
      message: () =>
        this.isNot
          ? `${hint}\n\n${nameOf(root)} ${passed}, expected otherwise`
          : [hint, "", `${nameOf(root)} ${failed(rows.length)}:`, ...lines(rows)].join("\n"),
    };
  };

const toHaveNoIntersections = noneFound(
  "toHaveNoIntersections",
  findIntersections as (
    root: AnyObject3D,
    options: IntersectionOptions,
  ) => ReturnType<typeof findIntersections>,
  "has no parts crossing",
  (n) => `has ${n} ${plural(n, "pair")} of parts crossing`,
  intersectionLines,
);
const toHaveNothingFloating = noneFound(
  "toHaveNothingFloating",
  findFloating as (root: AnyObject3D, options: FloatingOptions) => ReturnType<typeof findFloating>,
  "has nothing floating",
  (n) => `has ${n} ${plural(n, "group")} of parts floating`,
  floatingLines,
);
const toHaveNothingSunk = noneFound(
  "toHaveNothingSunk",
  findSunk as (root: AnyObject3D, options: SunkOptions) => ReturnType<typeof findSunk>,
  "has nothing sunk",
  (n) => `has ${n} ${plural(n, "part")} sunk into the ground`,
  sunkLines,
);
const toHaveNamedMeshes = noneFound(
  "toHaveNamedMeshes",
  findUnnamedMeshes as (
    root: AnyObject3D,
    options: UnnamedOptions,
  ) => ReturnType<typeof findUnnamedMeshes>,
  "has every mesh named",
  (n) => `has ${n} unnamed ${plural(n, "mesh", "meshes")}`,
  unnamedLines,
);
const toHaveSoundShadows = noneFound(
  "toHaveSoundShadows",
  findShadowIssues as (
    root: AnyObject3D,
    options: ShadowOptions,
  ) => ReturnType<typeof findShadowIssues>,
  "has a sound shadow setup",
  (n) => `has ${n} shadow ${plural(n, "problem")}`,
  issueLines,
);
const toHaveSoundColors = noneFound(
  "toHaveSoundColors",
  findColorIssues as (
    root: AnyObject3D,
    options: ColorOptions,
  ) => ReturnType<typeof findColorIssues>,
  "has sound colour management",
  (n) => `has ${n} colour ${plural(n, "problem")}`,
  issueLines,
);

/** The matchers, for `expect.extend` by hand. */
export const matchers = {
  toFitBudget,
  toHaveNoZFighting,
  toHaveCleanGeometry,
  toHaveNoIntersections,
  toHaveNothingFloating,
  toHaveNothingSunk,
  toHaveNamedMeshes,
  toHaveSoundShadows,
  toHaveSoundColors,
};

/** Registers the matchers on Vitest's `expect`. Importing this entry already has. */
export const installMatchers = () => {
  expect.extend(matchers);
};

installMatchers();

declare module "vitest" {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    /**
     * The object's triangles, draw calls, meshes and texture memory are within the budget's: a
     * part of `defineBudgets`'s, or its frame (`calls` counts as `draws`). Fails listing actual
     * against budget and the costliest meshes.
     */
    toFitBudget: (budget: PartBudget | FrameBudget, options?: FitBudgetOptions) => R;
    /** `findZFighting` finds nothing. Fails listing the pairs. */
    toHaveNoZFighting: (options?: ZFightingOptions) => R;
    /** No NaN geometry (`findBadGeometry`) and no empty meshes (`findEmptyMeshes`). */
    toHaveCleanGeometry: (options?: BadGeometryOptions) => R;
    /** `findIntersections` finds nothing. Fails listing the pairs and where they cross. */
    toHaveNoIntersections: (options?: IntersectionOptions) => R;
    /** `findFloating` finds nothing. Fails listing each floating group and how high it is. */
    toHaveNothingFloating: (options?: FloatingOptions) => R;
    /** `findSunk` finds nothing. Fails listing each sunk part and how deep it goes. */
    toHaveNothingSunk: (options?: SunkOptions) => R;
    /** `findUnnamedMeshes` finds nothing. Fails listing them, most triangles first. */
    toHaveNamedMeshes: (options?: UnnamedOptions) => R;
    /** `findShadowIssues` finds nothing. Pass `{ renderer }` to include its settings. */
    toHaveSoundShadows: (options?: ShadowOptions) => R;
    /** `findColorIssues` finds nothing. Pass `{ renderer }` to include its settings. */
    toHaveSoundColors: (options?: ColorOptions) => R;
  }
}
