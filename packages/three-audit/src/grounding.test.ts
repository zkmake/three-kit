import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
} from "three";
import { describe, expect, test } from "vitest";

import { findFloating, findSunk } from "./grounding.ts";

const material = new MeshBasicMaterial();

const box = (name: string, size: [number, number, number], at: [number, number, number]) => {
  const mesh = new Mesh(new BoxGeometry(...size), material);

  mesh.name = name;
  mesh.position.set(...at);

  return mesh;
};

/** A square slope: y = x / 2 across x and z in -5..5. */
const slope = () => {
  const geometry = new BufferGeometry();

  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [-5, -2.5, -5, -5, -2.5, 5, 5, 2.5, 5, -5, -2.5, -5, 5, 2.5, 5, 5, 2.5, -5],
      3,
    ),
  );

  const mesh = new Mesh(geometry, material);

  mesh.name = "hill";
  mesh.userData.studioObject = "hill";

  return mesh;
};

describe("findFloating", () => {
  test("a prop off the ground, by how much", () => {
    const scene = new Scene();

    scene.add(box("rock", [1, 1, 1], [0, 0.5, 0]), box("tank", [1, 1, 1], [5, 3.5, 0]));

    const rows = findFloating(scene);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      mesh: "tank [MeshBasicMaterial]",
      parts: 1,
      height: 3,
      at: [5, 3.5, 0],
      count: 1,
    });
    expect(rows[0]!.meshes[0]!.name).toBe("tank");
  });

  test("a stack holds together: what touches something grounded is grounded", () => {
    const scene = new Scene();

    scene.add(
      box("base", [2, 1, 2], [0, 0.5, 0]),
      box("middle", [1, 1, 1], [0, 1.5, 0]),
      box("top", [0.5, 1, 0.5], [0, 2.5, 0]),
    );

    expect(findFloating(scene)).toEqual([]);
  });

  test("a group touching itself but not the ground is one row, named by its lowest part", () => {
    const scene = new Scene();

    scene.add(
      box("crane-base", [1, 1, 1], [0, 2.5, 0]),
      box("crane-arm", [4, 0.2, 0.2], [0, 3.1, 0]),
    );

    const rows = findFloating(scene);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ mesh: "crane-base [MeshBasicMaterial]", parts: 2, height: 2 });
    expect(rows[0]!.meshes.map((mesh) => mesh.name).sort()).toEqual(["crane-arm", "crane-base"]);
  });

  test("says what's under it, for a thing short of a roof and not the ground", () => {
    const scene = new Scene();

    scene.add(
      box("building", [4, 10, 4], [0, 5, 0]),
      box("water-tank", [1, 1, 1], [0, 10.8, 0]),
      box("balloon", [1, 1, 1], [20, 30, 0]),
    );

    const rows = findFloating(scene);

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.mesh.startsWith("water-tank"))).toMatchObject({
      height: 10.3,
      over: "building [MeshBasicMaterial]",
      clearance: 0.3,
    });
    expect(rows.find((row) => row.mesh.startsWith("balloon"))).toMatchObject({
      over: null,
      clearance: null,
    });
  });

  test("gap sets what counts as touching", () => {
    const scene = new Scene();

    scene.add(box("rock", [1, 1, 1], [0, 0.51, 0]));

    expect(findFloating(scene)).toEqual([]);
    expect(findFloating(scene, { gap: 0.001 })).toHaveLength(1);
  });

  test("a height for the ground", () => {
    const scene = new Scene();

    scene.add(box("rock", [1, 1, 1], [0, 10.5, 0]));

    expect(findFloating(scene)).toHaveLength(1);
    expect(findFloating(scene, { ground: 10 })).toEqual([]);
  });

  test("a target for the ground: what touches it is grounded, and it's left out", () => {
    const scene = new Scene();
    const hill = slope();

    scene.add(hill, box("on-it", [1, 1, 1], [0, 0.4, 0]), box("over-it", [1, 1, 1], [0, 5.5, 3]));

    const rows = findFloating(scene, { ground: "hill", tagged: false });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.mesh).toMatch(/^over-it/);
    // The hill is flat across z and 0 at x = 0, so the box's bottom is 5 over it.
    expect(rows[0]!.height).toBe(5);
    expect(() => findFloating(scene, { ground: "nope" })).toThrow(/nope/);
  });

  test("no ground under a part gives a null height, listed first", () => {
    const scene = new Scene();
    const hill = slope();

    scene.add(hill, box("past-the-edge", [1, 1, 1], [50, 10, 0]), box("low", [1, 1, 1], [0, 5, 0]));

    const rows = findFloating(scene, { ground: "hill", tagged: false });

    expect(rows.map((row) => row.height)).toEqual([null, 4.5]);
  });

  test("instances stand alone; identical groups fold", () => {
    const scene = new Scene();
    const poles = new InstancedMesh(new BoxGeometry(0.1, 1, 0.1), material, 3);

    poles.name = "poles";
    poles.setMatrixAt(0, new Matrix4().makeTranslation(0, 0.5, 0));
    poles.setMatrixAt(1, new Matrix4().makeTranslation(5, 9, 0));
    poles.setMatrixAt(2, new Matrix4().makeTranslation(9, 9, 0));
    scene.add(poles);

    const rows = findFloating(scene);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ parts: 1, count: 2 });
  });

  test("skip leaves out what flies on purpose", () => {
    const scene = new Scene();
    const birds = new Group();

    birds.name = "birds";
    birds.add(box("bird", [0.2, 0.2, 0.2], [0, 30, 0]));
    scene.add(birds);

    expect(findFloating(scene)).toHaveLength(1);
    expect(findFloating(scene, { skip: (object) => object.name === "birds" })).toEqual([]);
  });
});

describe("findSunk", () => {
  test("how far under, and how much of it", () => {
    const scene = new Scene();

    scene.add(box("post", [0.2, 2, 0.2], [0, 0.5, 0]), box("rock", [1, 1, 1], [5, 0.5, 0]));

    const rows = findSunk(scene);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      mesh: "post [MeshBasicMaterial]",
      depth: 0.5,
      share: 0.25,
      buried: false,
      count: 1,
    });
    expect(rows[0]!.object.name).toBe("post");
  });

  test("wholly under the ground is buried, and listed first", () => {
    const scene = new Scene();

    scene.add(box("post", [0.2, 2, 0.2], [0, 0.5, 0]), box("lost", [1, 1, 1], [5, -3, 0]));

    expect(findSunk(scene).map((row) => [row.mesh, row.buried, row.share])).toEqual([
      ["lost [MeshBasicMaterial]", true, 1],
      ["post [MeshBasicMaterial]", false, 0.25],
    ]);
  });

  test("depth allows a little; a flat plane on the ground isn't sunk", () => {
    const scene = new Scene();
    const plane = new Mesh(new PlaneGeometry(10, 10), material);

    plane.rotation.x = -Math.PI / 2;
    scene.add(plane, box("post", [0.2, 2, 0.2], [0, 0.9, 0]));

    expect(findSunk(scene)).toHaveLength(1);
    expect(findSunk(scene, { depth: 0.2 })).toEqual([]);
  });

  test("a slab floor is under its own top, unless it's the ground", () => {
    const scene = new Scene();
    const floor = box("floor", [10, 1, 10], [0, 0.5, 0]);

    scene.add(floor, box("crate", [1, 1, 1], [0, 1.5, 0]));

    expect(findSunk(scene, { ground: 1 }).map((row) => row.mesh)).toEqual([
      "floor [MeshBasicMaterial]",
    ]);
    expect(findSunk(scene, { ground: "floor" })).toEqual([]);
  });

  test("against a target's surface, at the part's place", () => {
    const scene = new Scene();
    const hill = slope();

    // At x = 4 the hill is at 2, so a box from 0 to 3 goes 2 under it.
    scene.add(hill, box("post", [0.2, 3, 0.2], [4, 1.5, 0]));

    const rows = findSunk(scene, { ground: "hill", tagged: false });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.depth).toBeCloseTo(2, 2);
    expect(rows[0]!.share).toBeCloseTo(0.67, 2);
  });

  test("copies fold into their worst", () => {
    const scene = new Scene();
    const poles = new InstancedMesh(new BoxGeometry(0.1, 1, 0.1), material, 2);

    poles.name = "poles";
    poles.setMatrixAt(0, new Matrix4().makeTranslation(0, 0.4, 0));
    poles.setMatrixAt(1, new Matrix4().makeTranslation(5, 0.2, 0));
    scene.add(poles);

    const rows = findSunk(scene);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ count: 2, depth: 0.3, share: 0.3 });
  });
});
