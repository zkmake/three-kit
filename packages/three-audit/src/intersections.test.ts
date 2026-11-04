import {
  BatchedMesh,
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Scene,
} from "three";
import { describe, expect, test } from "vitest";

import { findIntersections } from "./intersections.ts";

const material = new MeshBasicMaterial();

const box = (name: string, size: [number, number, number], at: [number, number, number]) => {
  const mesh = new Mesh(new BoxGeometry(...size), material);

  mesh.name = name;
  mesh.position.set(...at);

  return mesh;
};

describe("findIntersections", () => {
  test("a post through a slab: both named, how far through, and where", () => {
    const scene = new Scene();

    scene.add(box("slab", [4, 0.2, 4], [0, 0, 0]), box("post", [0.2, 2, 0.2], [0, 0.5, 0]));

    const rows = findIntersections(scene);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.a).toBe("post [MeshBasicMaterial]");
    expect(rows[0]!.b).toBe("slab [MeshBasicMaterial]");
    expect(rows[0]!.crossings).toBeGreaterThan(0);
    // Round the post twice: where it goes in the top face, and out of the bottom one.
    expect(rows[0]!.length).toBeCloseTo(1.6, 3);
    expect(rows[0]!.depth).toBeGreaterThan(0);
    expect(rows[0]!.count).toBe(1);
    expect(rows[0]!.meshes.map((mesh) => mesh.name)).toEqual(["post", "slab"]);
    expect(Math.abs(rows[0]!.at[0])).toBeLessThanOrEqual(0.1);
    expect(Math.abs(rows[0]!.at[2])).toBeLessThanOrEqual(0.1);
  });

  test("resting on, side by side, and in one plane don't cross", () => {
    const scene = new Scene();

    scene.add(
      box("floor", [10, 1, 10], [0, -0.5, 0]),
      box("crate", [1, 1, 1], [0, 0.5, 0]),
      box("next", [1, 1, 1], [1, 0.5, 0]),
      // A face exactly in the floor's top plane, sharing its corner: z-fighting's question.
      box("mat", [1, 0, 1], [3, 0, 3]),
    );

    expect(findIntersections(scene)).toEqual([]);
  });

  test("one part wholly inside another has no crossing to find", () => {
    const scene = new Scene();

    scene.add(box("shell", [4, 4, 4], [0, 0, 0]), box("core", [1, 1, 1], [0, 0, 0]));

    expect(findIntersections(scene)).toEqual([]);
  });

  test("depth ignores parts seated a little into each other", () => {
    const scene = new Scene();

    // 5 cm into the floor's top.
    scene.add(box("floor", [10, 1, 10], [0, -0.5, 0]), box("leg", [0.2, 1, 0.2], [0, 0.45, 0]));

    expect(findIntersections(scene)).toHaveLength(1);
    expect(findIntersections(scene, { depth: 0.1 })).toEqual([]);
  });

  test("the world transform counts", () => {
    const scene = new Scene();
    const moved = new Group();

    moved.position.y = 100;
    moved.add(box("post", [0.2, 2, 0.2], [0, 0, 0]));
    scene.add(box("slab", [4, 0.2, 4], [0, 0, 0]), moved);

    expect(findIntersections(scene)).toEqual([]);

    moved.position.y = 0;

    expect(findIntersections(scene)).toHaveLength(1);
  });

  test("between keeps only crossings with one side in each", () => {
    const scene = new Scene();
    const tree = box("crown", [2, 2, 2], [0, 0, 0]);
    const wire = box("wire", [10, 0.05, 0.05], [0, 0.5, 0]);
    const trunk = box("trunk", [0.5, 4, 0.5], [0, 0, 0]);

    tree.userData.studioObject = "trees";
    trunk.userData.studioObject = "trees";
    wire.userData.studioObject = "wires";
    scene.add(tree, trunk, wire);

    const rows = findIntersections(scene, { between: ["trees", "wires"] });

    expect(rows.map((row) => [row.a, row.b]).sort()).toEqual([
      ["crown [MeshBasicMaterial]", "wire [MeshBasicMaterial]"],
      ["trunk [MeshBasicMaterial]", "wire [MeshBasicMaterial]"],
    ]);
    expect(() => findIntersections(scene, { between: ["trees", "nothing"] })).toThrow(/nothing/);
  });

  test("allow leaves out the joins that are meant", () => {
    const scene = new Scene();

    scene.add(box("door", [1, 2, 0.1], [0, 0, 0]), box("handle", [0.05, 0.05, 0.5], [0, 0, 0]));

    expect(findIntersections(scene)).toHaveLength(1);
    expect(
      findIntersections(scene, {
        allow: (a, b) => [a.name, b.name].includes("handle"),
      }),
    ).toEqual([]);
  });

  test("instances and batch members cross as themselves, folded by mesh", () => {
    const scene = new Scene();
    const posts = new InstancedMesh(new BoxGeometry(0.2, 2, 0.2), material, 3);

    posts.name = "posts";
    posts.setMatrixAt(0, new Matrix4().makeTranslation(-1, 0, 0));
    posts.setMatrixAt(1, new Matrix4().makeTranslation(1, 0, 0));
    posts.setMatrixAt(2, new Matrix4().makeTranslation(50, 0, 0));
    scene.add(box("slab", [4, 0.2, 4], [0, 0, 0]), posts);

    const rows = findIntersections(scene);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.a).toMatch(/^posts/);
    expect(rows[0]!.count).toBe(2);
  });

  test("a batch's members, and with instances, copies against each other", () => {
    const scene = new Scene();
    const batch = new BatchedMesh(4, 100, 200, material);
    const id = batch.addGeometry(new BoxGeometry(1, 1, 1));

    batch.name = "props";
    batch.setMatrixAt(batch.addInstance(id), new Matrix4().makeTranslation(0, 0, 0));
    batch.setMatrixAt(batch.addInstance(id), new Matrix4().makeTranslation(0.5, 0.5, 0.5));
    scene.add(batch, box("wall", [0.1, 4, 4], [0, 0, 0]));

    expect(findIntersections(scene)).toHaveLength(1);
    expect(findIntersections(scene).at(0)!.count).toBe(2);
    expect(findIntersections(scene, { instances: true })).toHaveLength(2);
  });

  test("hidden objects and what a shader positions stay out; tags narrow it", () => {
    const scene = new Scene();
    const hidden = box("hidden", [0.2, 2, 0.2], [0, 0, 0]);
    const shaded = box("shaded", [0.2, 2, 0.2], [1, 0, 0]);

    hidden.visible = false;
    shaded.material = Object.assign(new MeshBasicMaterial(), { positionNode: {} });
    scene.add(box("slab", [4, 0.2, 4], [0, 0, 0]), hidden, shaded);

    expect(findIntersections(scene)).toEqual([]);

    const post = box("post", [0.2, 2, 0.2], [-1, 0, 0]);

    scene.add(post);

    expect(findIntersections(scene)).toHaveLength(1);

    post.userData.studioObject = "post";

    // Now only the tagged post counts, and it has nothing tagged to cross.
    expect(findIntersections(scene)).toEqual([]);
    expect(findIntersections(scene, { tagged: false })).toHaveLength(1);
  });

  test("rows are JSON-safe", () => {
    const scene = new Scene();

    scene.add(box("slab", [4, 0.2, 4], [0, 0, 0]), box("post", [0.2, 2, 0.2], [0, 0, 0]));

    const [row] = findIntersections(scene);

    expect(Object.keys(row!)).toEqual(["a", "b", "crossings", "length", "depth", "at", "count"]);
    expect(() => JSON.stringify(row)).not.toThrow();
  });
});
