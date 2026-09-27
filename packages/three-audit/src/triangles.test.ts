import {
  BatchedMesh,
  BoxGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
} from "three";
import { describe, expect, test } from "vitest";

import { triangleCount } from "./scene.ts";
import { countTriangles, geometryCensus, listMeshes } from "./triangles.ts";

const material = new MeshBasicMaterial();

const named = <T extends { name: string }>(object: T, name: string) => {
  object.name = name;

  return object;
};

describe("triangleCount", () => {
  test("indexed, non-indexed and draw range", () => {
    const box = new BoxGeometry();

    expect(triangleCount(box)).toBe(12);
    expect(triangleCount(box.toNonIndexed())).toBe(12);

    box.setDrawRange(6, 12);
    expect(triangleCount(box)).toBe(4);

    box.setDrawRange(30, Infinity);
    expect(triangleCount(box)).toBe(2);
  });
});

describe("scene totals", () => {
  const scene = () => {
    const box = new BoxGeometry();
    const plane = named(new PlaneGeometry(), "leaf");
    const trees = named(new InstancedMesh(plane, material, 50), "trees");
    const hidden = new Group();

    trees.count = 40;
    hidden.visible = false;
    hidden.add(named(new Mesh(box, material), "hidden"));

    const batch = named(new BatchedMesh(4, 100, 200, material), "batch");
    const boxId = batch.addGeometry(new BoxGeometry());
    const planeId = batch.addGeometry(new PlaneGeometry());

    batch.addInstance(boxId);
    batch.addInstance(boxId);
    batch.setVisibleAt(batch.addInstance(planeId), false);
    batch.deleteInstance(batch.addInstance(planeId));

    return new Scene().add(named(new Mesh(box, material), "crate"), trees, hidden, batch);
  };

  test("countTriangles: visible meshes, instances and batches counted", () => {
    // crate 12 + trees 40 × 2 + batch 2 boxes × 12
    expect(countTriangles(scene())).toBe(12 + 80 + 24);
  });

  test("listMeshes: most triangles first", () => {
    expect(listMeshes(scene())).toEqual([
      { name: "trees", triangles: 2, instances: 40, total: 80 },
      { name: "batch", triangles: 12, instances: 2, total: 24 },
      { name: "crate", triangles: 12, instances: 1, total: 12 },
    ]);
  });

  test("geometryCensus: hidden meshes included, batches left out", () => {
    const rows = geometryCensus(scene());

    expect(rows[0]).toEqual({ geometry: "leaf", uses: 40, triangles: 2, total: 80 });
    expect(rows[1]).toMatchObject({ uses: 2, triangles: 12, total: 24 });
    expect(rows[1]!.geometry).toMatch(/^BoxGeometry:/);
    expect(rows).toHaveLength(2);
  });

  test("skip prunes", () => {
    expect(countTriangles(scene(), { skip: (object) => object.name === "trees" })).toBe(36);
  });
});
