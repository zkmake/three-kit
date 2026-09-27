import { BatchedMesh, BoxGeometry, MeshBasicMaterial, PlaneGeometry, SphereGeometry } from "three";
import { describe, expect, test } from "vitest";

import { addGeometryWithRoom, addInstanceWithRoom, createBatch } from "./batch.ts";
import { levelFor, pinLevel } from "./levels.ts";

const material = new MeshBasicMaterial();

describe("createBatch", () => {
  test("sized for exactly its geometries", () => {
    const { mesh, ids } = createBatch([new BoxGeometry(), new PlaneGeometry()], material, {
      name: "props",
    });

    expect(ids).toEqual([0, 1]);
    expect(mesh.name).toBe("props");
    expect(mesh.unusedVertexCount).toBe(0);
    expect(mesh.unusedIndexCount).toBe(0);
    expect(mesh.maxInstanceCount).toBe(2);
    expect(mesh.frustumCulled).toBe(false);
  });
});

describe("room", () => {
  test("repacks, then grows, as geometries arrive", () => {
    const batch = new BatchedMesh(1, 24, 36, material);
    const box = new BoxGeometry();
    const first = addGeometryWithRoom(batch, box);

    // Full: the second box doubles the room.
    addGeometryWithRoom(batch, box);
    expect(batch.unusedVertexCount).toBe(0);

    // A deleted box's space is reclaimed by repacking before growing.
    batch.deleteGeometry(first);
    addGeometryWithRoom(batch, box);
    expect(batch.unusedVertexCount).toBe(0);

    // A big sphere grows it by as many doublings as it needs.
    const sphere = addGeometryWithRoom(batch, new SphereGeometry(1, 32, 16));

    expect(batch.getGeometryRangeAt(sphere)!.vertexCount).toBe(561);
  });

  test("instances double when full", () => {
    const { mesh, ids } = createBatch([new BoxGeometry()], material);

    addInstanceWithRoom(mesh, ids[0]!);
    addInstanceWithRoom(mesh, ids[0]!);
    addInstanceWithRoom(mesh, ids[0]!);
    expect(mesh.instanceCount).toBe(3);
    expect(mesh.maxInstanceCount).toBe(4);
  });
});

describe("levelFor", () => {
  const options = { distance: 30, hysteresis: 2 };

  test("switches far past the distance, near only inside the margin", () => {
    expect(levelFor(29, "near", options)).toBe("near");
    expect(levelFor(31, "near", options)).toBe("far");
    expect(levelFor(29, "far", options)).toBe("far");
    expect(levelFor(27.9, "far", options)).toBe("near");
  });

  test("a pin overrides distance", () => {
    pinLevel("near");
    expect(levelFor(1000, "far", options)).toBe("near");
    pinLevel(null);
    expect(levelFor(1000, "far", options)).toBe("far");
  });
});
