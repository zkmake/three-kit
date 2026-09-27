import { BoxGeometry, type InstancedMesh, Matrix4, MeshBasicMaterial, SphereGeometry } from "three";
import { describe, expect, test } from "vitest";

import { InstancePool } from "./instance-pool.ts";

describe("InstancePool", () => {
  test("draws exactly the copies pushed each frame, every part together", () => {
    const pool = new InstancePool(
      [
        { geometry: new BoxGeometry(), material: new MeshBasicMaterial({ name: "tyre" }) },
        { geometry: new SphereGeometry(), material: new MeshBasicMaterial({ name: "hub" }) },
      ],
      { name: "wheels", capacity: 2, configure: (mesh) => (mesh.castShadow = true) },
    );
    const meshes = () => pool.group.children as InstancedMesh[];

    expect(meshes().map((mesh) => mesh.name)).toEqual(["wheels:tyre", "wheels:hub"]);

    pool.begin();
    pool.push(new Matrix4().makeTranslation(1, 0, 0));
    pool.push(new Matrix4().makeTranslation(2, 0, 0));
    // Past its room: the pool grows and keeps what was pushed.
    pool.push(new Matrix4().makeTranslation(3, 0, 0));
    pool.end();

    expect(pool.capacity).toBe(4);
    expect(meshes()).toHaveLength(2);
    expect(meshes().every((mesh) => mesh.count === 3 && mesh.castShadow)).toBe(true);
    expect(meshes()[1]!.getMatrixAt(0, new Matrix4()).elements[12]).toBe(1);
    expect(meshes()[1]!.getMatrixAt(2, new Matrix4()).elements[12]).toBe(3);

    pool.begin();
    pool.push(new Matrix4());
    pool.end();
    expect(meshes()[0]!.count).toBe(1);

    pool.dispose();
    expect(pool.group.children).toHaveLength(0);
  });
});
