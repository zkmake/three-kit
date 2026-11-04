import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
} from "three";
import { describe, expect, test } from "vitest";

import { findUnnamedMeshes } from "./unnamed-meshes.ts";

const material = new MeshBasicMaterial({ name: "paint" });

describe("findUnnamedMeshes", () => {
  test("named on the mesh or its geometry passes", () => {
    const scene = new Scene();
    const own = new Mesh(new BoxGeometry(), material);
    const geometry = new BoxGeometry();

    own.name = "lid";
    geometry.name = "hinge";
    scene.add(own, new Mesh(geometry, material));

    expect(findUnnamedMeshes(scene)).toEqual([]);
  });

  test("the rest are listed as the other checks call them, most triangles first", () => {
    const scene = new Scene();
    const kart = new Group();

    kart.name = "kart";
    kart.add(new Mesh(new PlaneGeometry(), material), new Mesh(new BoxGeometry(), material));
    scene.add(kart);

    const rows = findUnnamedMeshes(scene);

    expect(rows.map((row) => [row.mesh, row.triangles])).toEqual([
      ["kart/BoxGeometry [paint]", 12],
      ["kart/PlaneGeometry [paint]", 2],
    ]);
    expect(rows[0]!.object.geometry.type).toBe("BoxGeometry");
  });

  test("the same unnamed mesh many times is one row", () => {
    const scene = new Scene();

    scene.add(
      new Mesh(new BoxGeometry(), material),
      new Mesh(new BoxGeometry(), material),
      new InstancedMesh(new PlaneGeometry(), material, 10),
    );

    expect(findUnnamedMeshes(scene).map((row) => [row.mesh, row.triangles, row.count])).toEqual([
      ["BoxGeometry [paint]", 24, 2],
      ["PlaneGeometry [paint]", 20, 1],
    ]);
  });

  test("hidden and skipped ones stay out", () => {
    const scene = new Scene();
    const hidden = new Mesh(new BoxGeometry(), material);
    const skipped = new Group();

    hidden.visible = false;
    skipped.name = "debug";
    skipped.add(new Mesh(new BoxGeometry(), material));
    scene.add(hidden, skipped);

    expect(findUnnamedMeshes(scene, { skip: (object) => object.name === "debug" })).toEqual([]);
  });
});
