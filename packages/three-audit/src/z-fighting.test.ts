import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { describe, expect, test } from "vitest";

import { findZFighting } from "./z-fighting.ts";

const material = new MeshBasicMaterial();

const box = (name: string, size: [number, number, number], at: [number, number, number]) => {
  const mesh = new Mesh(new BoxGeometry(...size), material);

  mesh.name = name;
  mesh.position.set(...at);

  return mesh;
};

describe("findZFighting", () => {
  test("two boxes resting on one floor fight on their bottoms", () => {
    const scene = new Scene();

    // Both bottoms at y = 0, the plinth's footprint overlapping the wall's.
    scene.add(box("plinth", [2, 0.2, 2], [0, 0.1, 0]), box("wall", [1, 1, 1], [0, 0.5, 0]));

    const rows = findZFighting(scene);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.a).toMatch(/^plinth /);
    expect(rows[0]!.b).toMatch(/^wall /);
    expect(rows[0]!.triangles).toBeGreaterThan(0);
    expect(rows[0]!.meshes.map((mesh) => mesh.name)).toEqual(["plinth", "wall"]);
  });

  test("a part stood 5 mm off is clean", () => {
    const scene = new Scene();

    scene.add(box("plinth", [2, 0.2, 2], [0, 0.1, 0]), box("wall", [1, 1, 1], [0, 0.505, 0]));

    expect(findZFighting(scene)).toEqual([]);
  });

  test("faces merely touching along an edge don't count", () => {
    const scene = new Scene();

    scene.add(box("left", [1, 1, 1], [-0.5, 0, 0]), box("right", [1, 1, 1], [0.5, 0, 0]));

    expect(findZFighting(scene)).toEqual([]);
  });

  test("opposite-facing coplanar faces don't count", () => {
    const scene = new Scene();
    const up = new Mesh(new PlaneGeometry(1, 1), material);
    const down = new Mesh(new PlaneGeometry(1, 1), material);

    up.rotation.x = -Math.PI / 2;
    down.rotation.x = Math.PI / 2;
    scene.add(up, down);

    expect(findZFighting(scene)).toEqual([]);
  });

  test("works in world space, through parent transforms", () => {
    const scene = new Scene();
    const group = new Group();
    const plane = new Mesh(new PlaneGeometry(1, 1), material);
    const decal = new Mesh(new PlaneGeometry(0.5, 0.5), material);

    group.position.set(10, 2, -3);
    group.rotation.y = 0.7;
    decal.position.set(0.1, 0.1, 0.002);
    group.add(plane);
    scene.add(group, decal);

    // The decal sits outside the group: it only fights once moved with it.
    expect(findZFighting(scene)).toEqual([]);

    group.add(decal);
    expect(findZFighting(scene)).toHaveLength(1);
    expect(findZFighting(scene, { gap: 0.001 })).toEqual([]);
  });

  test("only tagged parts when anything is tagged", () => {
    const scene = new Scene();
    const object = new Group();
    // The ground slab shares both the foot's and the leg's top and bottom planes.
    object.userData.studioObject = "chair";
    object.add(box("foot", [1, 1, 1], [0, 0.5, 0]), box("leg", [0.5, 1, 0.5], [0, 0.5, 0]));
    scene.add(box("ground", [10, 1, 10], [0, 0.5, 0]), object);

    const rows = findZFighting(scene);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.a).toMatch(/^chair\/foot /);
    expect(rows[0]!.b).toMatch(/^chair\/leg /);
    expect(findZFighting(scene, { tagged: false })).toHaveLength(3);

    const tagged = new Scene().add(box("a", [1, 1, 1], [0, 0, 0]), box("b", [1, 1, 1], [0, 0, 0]));

    expect(findZFighting(tagged)).toHaveLength(1);
    expect(findZFighting(tagged, { tagged: true })).toEqual([]);
  });

  test("skip prunes a subtree", () => {
    const scene = new Scene();
    const baked = new Group();

    baked.userData.bakedResult = true;
    baked.add(box("merged", [1, 1, 1], [0, 0, 0]));
    scene.add(box("source", [1, 1, 1], [0, 0, 0]), baked);

    expect(findZFighting(scene)).toHaveLength(1);
    expect(findZFighting(scene, { skip: (o) => o.userData.bakedResult === true })).toEqual([]);
  });

  test("self finds fights inside one merged geometry", () => {
    const a = new BoxGeometry(1, 1, 1);
    const b = new BoxGeometry(1, 1, 1).translate(0.5, 0, 0);
    const scene = new Scene().add(new Mesh(mergeGeometries([a, b]), material));

    expect(findZFighting(scene)).toEqual([]);
    expect(findZFighting(scene, { self: true })).toHaveLength(1);
  });

  test("ignores instanced meshes, degenerate triangles and non-indexed quirks", () => {
    const sliver = new BufferGeometry();

    sliver.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 2, 0, 0], 3));

    const scene = new Scene().add(
      new InstancedMesh(new BoxGeometry(), material, 2),
      new Mesh(sliver, material),
      new Mesh(sliver, material),
      new Mesh(new BoxGeometry().toNonIndexed(), material),
    );

    expect(findZFighting(scene)).toEqual([]);
  });

  test("rows serialise without the meshes", () => {
    const scene = new Scene().add(box("a", [1, 1, 1], [0, 0, 0]), box("b", [1, 1, 1], [0, 0, 0]));
    const [row] = findZFighting(scene);

    expect(Object.keys(row!)).toEqual(["a", "b", "triangles"]);
    expect(JSON.parse(JSON.stringify(row))).toEqual({ a: row!.a, b: row!.b, triangles: 12 });
  });
});
