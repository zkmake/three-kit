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
import { countDraws, countTriangles, geometryCensus, listMeshes } from "./triangles.ts";

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
      { name: "trees", material: "MeshBasicMaterial", triangles: 2, instances: 40, total: 80 },
      { name: "batch", material: "MeshBasicMaterial", triangles: 12, instances: 2, total: 24 },
      { name: "crate", material: "MeshBasicMaterial", triangles: 12, instances: 1, total: 12 },
    ]);
  });

  test("geometryCensus: hidden meshes included, batches broken down by geometry", () => {
    const rows = geometryCensus(scene());

    // leaf 80, box geometry (crate + hidden) 24, the batch's box 24; its hidden plane isn't drawn.
    expect(rows[0]).toEqual({ geometry: "leaf", uses: 40, triangles: 2, total: 80, share: 0.625 });
    expect(
      rows.slice(1).map((row) => [row.geometry.replace(/:.*/, ":…"), row.uses, row.total]),
    ).toEqual([
      ["BoxGeometry:…", 2, 24],
      ["batch#0", 2, 24],
    ]);
    expect(rows.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 2);
  });

  test("geometryCensus: a batch's geometries by label, flagged over budget", () => {
    const labels = ["box", "plane"];
    const rows = geometryCensus(scene(), { label: (_batch, id) => labels[id], budget: 0.5 });

    expect(rows.map((row) => [row.geometry.replace(/:.*/, ""), row.overBudget])).toEqual([
      ["leaf", true],
      ["BoxGeometry", false],
      ["box", false],
    ]);
  });

  test("countDraws: one per visible mesh, one per material group", () => {
    const box = new BoxGeometry();
    const faces = new Mesh(
      box,
      Array.from({ length: 6 }, () => new MeshBasicMaterial()),
    );
    const off = new Mesh(box, new MeshBasicMaterial({ visible: false }));

    // crate, trees, batch: the hidden group's mesh doesn't draw.
    expect(countDraws(scene())).toBe(3);
    expect(countDraws(new Scene().add(faces, off))).toBe(6);
  });

  test("listMeshes names a mesh by its named ancestors", () => {
    const hands = new Group();
    const arm = new Group();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());

    hands.name = "CharacterHands";
    arm.name = "left";
    hands.add(arm.add(new Group().add(mesh)));

    expect(listMeshes(new Scene().add(hands))[0]!.name).toBe("CharacterHands/left/BoxGeometry");
  });

  test("takes a scene from another copy of three's types", () => {
    // Stands in for a newer @types/three: the same flag, members this copy doesn't know.
    type Newer = { readonly isObject3D: true; children: Newer[]; newerMethod(): void };

    expect(countTriangles(scene() as unknown as Newer)).toBe(116);
  });

  test("skip prunes", () => {
    expect(countTriangles(scene(), { skip: (object) => object.name === "trees" })).toBe(36);
  });
});
