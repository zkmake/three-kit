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
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { describe, expect, test } from "vitest";

import { measureBounds, measureClearance } from "./measure.ts";

const material = new MeshBasicMaterial();

const box = (size: [number, number, number], at: [number, number, number], name = "") => {
  const mesh = new Mesh(new BoxGeometry(...size), material);

  mesh.name = name;
  mesh.position.set(...at);

  return mesh;
};

/** A tower: two legs and a crossbar whose underside is at y = 3.65, over rails at y = 0. */
const tower = () => {
  const group = new Group();

  group.userData.studioObject = "tower";
  group.add(
    box([0.4, 4, 0.4], [-3, 2, 0], "leg"),
    box([0.4, 4, 0.4], [3, 2, 0], "leg"),
    box([6.4, 0.35, 0.4], [0, 3.825, 0], "crossbar"),
  );

  return group;
};

/** A car 3.5 tall, standing on the rails. */
const train = () => {
  const group = new Group();

  group.userData.studioObject = "train";
  group.add(box([2, 3.5, 6], [0, 1.75, 0], "car"));

  return group;
};

describe("measureBounds", () => {
  test("a tagged object's envelope, through parent transforms", () => {
    const moved = train();

    moved.position.set(10, 0, -2);

    expect(measureBounds(new Scene().add(moved), "train")).toEqual({
      min: [9, 0, -5],
      max: [11, 3.5, 1],
      size: [2, 3.5, 6],
      centre: [10, 1.75, -2],
    });
  });

  test("measures rotated vertices, not a rotated box", () => {
    const cube = box([1, 1, 1], [0, 0, 0]);

    cube.rotation.y = Math.PI / 4;

    expect(measureBounds(new Scene().add(cube), cube)!.size).toEqual([1.414, 1, 1.414]);
  });

  test("counts every instance of instanced and batched meshes", () => {
    const instanced = new InstancedMesh(new BoxGeometry(), material, 2);
    const batch = new BatchedMesh(2, 100, 200, material);
    const id = batch.addGeometry(new BoxGeometry());

    instanced.setMatrixAt(1, new Matrix4().makeTranslation(5, 0, 0));
    batch.setMatrixAt(batch.addInstance(id), new Matrix4().makeTranslation(0, -4, 0));
    batch.setMatrixAt(batch.addInstance(id), new Matrix4().makeTranslation(0, 4, 0));

    expect(measureBounds(new Scene().add(instanced), instanced)!.max[0]).toBe(5.5);
    expect(measureBounds(new Scene().add(batch), batch)!.size[1]).toBe(9);
  });

  test("falls back to object names; null when nothing draws; throws on no match", () => {
    const scene = new Scene().add(box([1, 2, 1], [0, 0, 0], "crate"), new Group());

    expect(measureBounds(scene, "crate")!.size).toEqual([1, 2, 1]);
    expect(measureBounds(scene, scene.children[1]!)).toBeNull();
    expect(() => measureBounds(scene, "barrel")).toThrow(/barrel/);
  });
});

describe("measureClearance", () => {
  test("the train clears the crossbar by 0.15, straight up", () => {
    expect(measureClearance(new Scene().add(tower(), train()), "train", "tower")).toEqual({
      gap: 0.15,
      axis: "y",
      between: ["train/car [MeshBasicMaterial]", "tower/crossbar [MeshBasicMaterial]"],
    });
  });

  test("0 when they touch or intersect", () => {
    const tall = train();

    tall.scale.y = 1.1;

    expect(measureClearance(new Scene().add(tower(), tall), "train", "tower")!.gap).toBe(0);
  });

  test("measures between triangles, so a merged object's own box doesn't hide the gap", () => {
    // Merged into one mesh, the tower's box contains the car; its triangles still don't touch it.
    const merged = new Mesh(
      mergeGeometries(
        tower().children.map((part) => {
          part.updateMatrix();

          return (part as Mesh).geometry.clone().applyMatrix4(part.matrix);
        }),
      ),
      material,
    );

    merged.userData.studioObject = "tower";

    expect(measureClearance(new Scene().add(merged, train()), "train", "tower")).toMatchObject({
      gap: 0.15,
      axis: "y",
    });
  });

  test("a diagonal gap has no axis", () => {
    const scene = new Scene().add(box([1, 1, 1], [0, 0, 0], "a"), box([1, 1, 1], [2, 2, 0], "b"));

    expect(measureClearance(scene, "a", "b")).toMatchObject({ gap: 1.414, axis: null });
  });
});
