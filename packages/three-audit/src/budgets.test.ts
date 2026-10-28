import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, test } from "vitest";

import { checkBudget, defineBudgets, parseBudgets } from "./budgets.ts";

const material = new MeshBasicMaterial();

/** Two boxes and 10 instanced boxes: 144 triangles, 3 draws, 3 meshes. */
const kart = () =>
  new Group().add(
    new Mesh(new BoxGeometry(), material),
    new Mesh(new BoxGeometry(), material),
    new InstancedMesh(new BoxGeometry(), material, 10),
  );

describe("defineBudgets", () => {
  test("returns the budgets frozen, parts typed", () => {
    const budgets = defineBudgets({
      frame: { fps: 60, calls: 150, triangles: 250_000 },
      parts: { kart: { triangles: 7_500, draws: 12 } },
    });

    expect(budgets.parts.kart.triangles).toBe(7_500);
    expect(Object.isFrozen(budgets)).toBe(true);
    expect(Object.isFrozen(budgets.frame)).toBe(true);
    expect(Object.isFrozen(budgets.parts)).toBe(true);
    expect(Object.isFrozen(budgets.parts.kart)).toBe(true);

    // @ts-expect-error -- a part that isn't listed
    expect(budgets.parts.truck).toBeUndefined();
  });

  test("parts are optional", () => {
    expect(defineBudgets({ frame: { fps: 60 } }).parts).toEqual({});
  });
});

describe("parseBudgets", () => {
  test("takes JSON-shaped budgets and drops undefined limits", () => {
    expect(
      parseBudgets({ frame: { triangles: 1000, calls: undefined }, parts: { a: { meshes: 2 } } }),
    ).toEqual({ frame: { triangles: 1000 }, parts: { a: { meshes: 2 } } });
  });

  test("names the first bad key", () => {
    expect(() => parseBudgets(null)).toThrow(/must be an object/);
    expect(() => parseBudgets({ frame: { tris: 5 } })).toThrow(/frame has "tris"/);
    expect(() => parseBudgets({ frame: {}, parts: { kart: { triangles: -1 } } })).toThrow(
      /parts\.kart\.triangles must be a number ≥ 0/,
    );
    expect(() => parseBudgets({ frame: {}, parts: [] })).toThrow(/parts must be an object/);
  });
});

describe("checkBudget", () => {
  test("one row per limit set, over when past it", () => {
    expect(checkBudget(kart(), { triangles: 100, draws: 3, meshes: 5 })).toEqual([
      { metric: "triangles", actual: 144, limit: 100, over: true },
      { metric: "draws", actual: 3, limit: 3, over: false },
      { metric: "meshes", actual: 3, limit: 5, over: false },
    ]);
  });

  test("a frame budget's calls count as draws; fps and textureMB aren't measured", () => {
    expect(checkBudget(kart(), { fps: 60, calls: 2, textureMB: 64 })).toEqual([
      { metric: "draws", actual: 3, limit: 2, over: true },
    ]);
  });
});
