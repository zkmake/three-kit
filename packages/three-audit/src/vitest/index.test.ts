import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from "three";
import { describe, expect, test } from "vitest";

import { defineBudgets } from "../budgets.ts";
import { triangles } from "./index.ts";

const material = new MeshBasicMaterial();

const named = <T extends { name: string }>(object: T, name: string) => {
  object.name = name;

  return object;
};

const wheel = (name: string, x: number) => {
  const mesh = named(new Mesh(new PlaneGeometry(), material), name);

  mesh.position.x = x;

  return mesh;
};

/** A 12-triangle body and two 2-triangle wheels: 16 triangles, 3 draws. */
const kart = () =>
  named(
    new Group().add(
      named(new Mesh(new BoxGeometry(), material), "body"),
      wheel("wheel-l", -1),
      wheel("wheel-r", 1),
    ),
    "kart",
  );

const budgets = defineBudgets({
  frame: { fps: 60, calls: 150, triangles: 250_000 },
  parts: { kart: { triangles: 20, draws: 3 }, tiny: { triangles: 10, meshes: 2 } },
});

/** What a failing `assert` throws. */
const failure = (assert: () => void) => {
  try {
    assert();
  } catch (error) {
    return (error as Error).message;
  }

  throw new Error("expected the assertion to fail");
};

describe("triangles", () => {
  test("is the main entry's", () => {
    expect(triangles(new BoxGeometry())).toBe(12);
  });
});

describe("toFitBudget", () => {
  test("passes within a part's budget, and the frame's", () => {
    expect(kart()).toFitBudget(budgets.parts.kart);
    expect(kart()).toFitBudget(budgets.frame);
    expect(kart()).not.toFitBudget(budgets.parts.tiny);
  });

  test("fails with actual against budget and the costliest meshes", () => {
    const message = failure(() => expect(kart()).toFitBudget(budgets.parts.tiny));

    expect(message).toContain(`"kart" is over its budget on triangles, meshes:`);
    expect(message).toMatch(/triangles 16 > 10 {2}✗/);
    expect(message).toMatch(/meshes\s+3 > 2 {2}✗/);
    expect(message).toMatch(/most triangles:\n\s+12 {2}kart\/body\n\s+2 {2}kart\/wheel-l/);
  });

  test("lists `top` meshes, and skips what `skip` leaves out", () => {
    const message = failure(() =>
      expect(kart()).toFitBudget({ triangles: 1 }, { top: 1, skip: (o) => o.name === "body" }),
    );

    expect(message).toMatch(/triangles 4 > 1/);
    expect(message).not.toContain("wheel-r");
  });

  test("works as an asymmetric matcher", () => {
    expect({ kart: kart() }).toEqual({ kart: expect.toFitBudget(budgets.parts.kart) });
  });

  test("throws on an empty budget or a non-object", () => {
    expect(() => expect(kart()).toFitBudget({})).toThrow(/sets no triangles/);
    expect(() => expect(42).toFitBudget(budgets.parts.kart)).toThrow(/expected a three.js object/);
  });
});

describe("toHaveNoZFighting", () => {
  test("passes on a clean object and fails listing the pairs", () => {
    const floor = named(new Mesh(new PlaneGeometry(4, 4), material), "floor");
    const rug = named(new Mesh(new PlaneGeometry(1, 1), material), "rug");

    rug.position.z = 0.001;

    expect(kart()).toHaveNoZFighting();
    expect(new Group().add(floor, rug)).toHaveNoZFighting({ gap: 0.0005 });

    const message = failure(() => expect(new Group().add(floor, rug)).toHaveNoZFighting());

    expect(message).toContain("has 1 z-fighting pair:");
    expect(message).toMatch(/floor \[MeshBasicMaterial\].*\n\s+↔ rug/);
    expect(message).toMatch(/2 triangles in z = 0\.00\d, facing \+z/);
  });
});

describe("toHaveCleanGeometry", () => {
  test("fails on NaN geometry and on empty meshes", () => {
    const nan = new BufferGeometry();

    nan.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, NaN, 1, 0], 3));

    const broken = new Group().add(
      named(new Mesh(nan, material), "torn"),
      named(new Mesh(new BufferGeometry(), material), "hollow"),
    );

    expect(kart()).toHaveCleanGeometry();
    expect(broken).not.toHaveCleanGeometry();

    const message = failure(() => expect(broken).toHaveCleanGeometry());

    expect(message).toContain("has 1 mesh with NaN geometry:");
    expect(message).toMatch(/torn: 1 non-finite, 0 zero normals/);
    expect(message).toContain("has 1 empty mesh (no vertices):");
    expect(message).toContain("hollow");
  });
});
