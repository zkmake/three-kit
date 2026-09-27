import { describe, expect, test } from "vitest";

import { isOverBudget, resolveBudgets } from "./budgets.ts";

describe("resolveBudgets", () => {
  test("timing defaults come from 60 FPS; counts have none", () => {
    const { frameMs, limits } = resolveBudgets(undefined);

    expect(frameMs).toBeCloseTo(16.67, 2);
    expect(limits.fps).toBe(57);
    expect(limits.low).toBe(30);
    expect(limits.cpu).toBeCloseTo(16.67, 2);
    expect(limits.gpu).toBeCloseTo(16.67, 2);
    expect(limits.p99).toBeCloseTo(25);
    expect(limits.calls).toBeUndefined();
  });

  test("targetFps rescales the defaults; keys override; null drops one", () => {
    const { limits } = resolveBudgets({ calls: 500, gpu: null, targetFps: 120 });

    expect(limits.fps).toBe(114);
    expect(limits.cpu).toBeCloseTo(8.33, 2);
    expect(limits.gpu).toBeUndefined();
    expect(limits.calls).toBe(500);
    expect(limits).not.toHaveProperty("targetFps");
  });

  test("false turns every budget off", () => {
    expect(resolveBudgets(false).limits).toEqual({});
  });
});

describe("isOverBudget", () => {
  const budgets = resolveBudgets({ calls: 500 });

  test("fps and 1% low are floors", () => {
    expect(isOverBudget(budgets, "fps", 50)).toBe(true);
    expect(isOverBudget(budgets, "fps", 60)).toBe(false);
    expect(isOverBudget(budgets, "low", 29)).toBe(true);
  });

  test("everything else is a ceiling, and the limit itself is within budget", () => {
    expect(isOverBudget(budgets, "calls", 501)).toBe(true);
    expect(isOverBudget(budgets, "calls", 500)).toBe(false);
    expect(isOverBudget(budgets, "cpu", 20)).toBe(true);
  });

  test("unknown values and metrics without a budget are never over", () => {
    expect(isOverBudget(budgets, "gpu", null)).toBe(false);
    expect(isOverBudget(budgets, "triangles", 1e9)).toBe(false);
  });
});
