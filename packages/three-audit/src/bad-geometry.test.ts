import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene } from "three";
import { describe, expect, test } from "vitest";

import { findBadGeometry } from "./bad-geometry.ts";

const material = new MeshBasicMaterial();

describe("findBadGeometry", () => {
  test("a clean box passes", () => {
    expect(findBadGeometry(new Scene().add(new Mesh(new BoxGeometry(), material)))).toEqual([]);
  });

  test("counts NaN positions and zero normals once per vertex", () => {
    const geometry = new BoxGeometry();

    geometry.attributes.position!.setX(0, Number.NaN);
    geometry.attributes.normal!.setXYZ(5, 0, 0, 0);

    const mesh = new Mesh(geometry, material);
    const part = new Group();

    mesh.name = "lid";
    part.userData.studioObject = "chest";
    part.add(mesh);
    mesh.visible = false;

    const rows = findBadGeometry(new Scene().add(part));

    expect(rows).toEqual([{ mesh: "lid", under: "chest", nonFinite: 1, zeroNormals: 1 }]);
    expect(rows[0]!.object).toBe(mesh);
  });

  test("a zero normal on a collapsed triangle is harmless", () => {
    const geometry = new BoxGeometry(1, 1, 0).toNonIndexed();

    // The first face (+x) has zero depth: every triangle on it has no area.
    for (let v = 0; v < 6; v += 1) {
      geometry.attributes.normal!.setXYZ(v, 0, 0, 0);
    }

    expect(findBadGeometry(new Scene().add(new Mesh(geometry, material)))).toEqual([]);
  });
});
