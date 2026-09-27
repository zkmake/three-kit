import {
  type BatchedMesh,
  BoxGeometry,
  Group,
  Matrix4,
  type MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  type WebGLRenderer,
} from "three";
import { describe, expect, test } from "vitest";

import { FollowBatch } from "./follow-batch.ts";

const paint = new MeshStandardMaterial({ name: "paint" });
const metal = new MeshStandardMaterial({ name: "metal" });

const car = (x: number) => {
  const group = new Group();

  group.position.x = x;

  return group;
};

const matrixOf = (mesh: BatchedMesh, instanceId: number) =>
  mesh.getMatrixAt(instanceId, new Matrix4()).elements[12];

/** Call the hooks the renderer would, with just enough renderer for three's culling. */
const render = (mesh: BatchedMesh, camera: PerspectiveCamera) => {
  mesh.onBeforeRender(
    {} as WebGLRenderer,
    null as never,
    camera,
    mesh.geometry,
    mesh.material as MeshBasicMaterial,
    null as never,
  );
};

describe("FollowBatch", () => {
  test("one batch per material; instances follow their objects", () => {
    const batch = new FollowBatch({ name: "train" });
    const engine = car(0);
    const wagon = car(5);

    batch.add({ object: engine, geometry: new BoxGeometry(), material: paint, castShadow: true });
    batch.add({ object: engine, geometry: new BoxGeometry(), material: metal });
    batch.add({ object: wagon, geometry: new BoxGeometry().toNonIndexed(), material: paint });

    const meshes = batch.group.children as BatchedMesh[];

    expect(meshes.map((mesh) => [mesh.name, mesh.instanceCount])).toEqual([
      ["train:paint", 2],
      ["train:metal", 1],
    ]);
    expect(meshes[0]!.castShadow).toBe(true);
    expect(meshes[1]!.castShadow).toBe(false);

    wagon.position.x = 12;
    batch.update();
    expect(matrixOf(meshes[0]!, 1)).toBe(12);
  });

  test("updates itself before rendering and picks levels from the camera", () => {
    const batch = new FollowBatch({ lod: { distance: 30 } });
    const wagon = car(0);
    const far = new BoxGeometry(1, 1, 1, 1, 1, 1);

    batch.add({
      object: wagon,
      geometry: new BoxGeometry(1, 1, 1, 4, 4, 4),
      far,
      material: paint,
    });

    const [mesh] = batch.group.children as BatchedMesh[];
    const camera = new PerspectiveCamera();

    // Starts on the far copy (geometry 1).
    expect(mesh!.getGeometryIdAt(0)).toBe(1);

    camera.position.set(0, 0, 10);
    camera.updateMatrixWorld();
    wagon.position.x = 3;
    render(mesh!, camera);
    expect(matrixOf(mesh!, 0)).toBe(3);
    expect(mesh!.getGeometryIdAt(0)).toBe(0);

    // The shadow pass picks levels from the camera, not the light's far-off shadow camera.
    const light = new OrthographicCamera();

    light.position.set(0, 500, 0);
    light.updateMatrixWorld();
    mesh!.onBeforeShadow(
      {} as WebGLRenderer,
      null as never,
      camera,
      light,
      mesh!.geometry,
      paint,
      null as never,
    );
    expect(mesh!.getGeometryIdAt(0)).toBe(0);

    camera.position.set(0, 0, 100);
    camera.updateMatrixWorld();
    render(mesh!, camera);
    expect(mesh!.getGeometryIdAt(0)).toBe(1);
  });

  test("release takes a member out; dispose empties the group and stays usable", () => {
    const batch = new FollowBatch();
    const release = batch.add({ object: car(0), geometry: new BoxGeometry(), material: paint });
    const [mesh] = batch.group.children as BatchedMesh[];

    release();
    release();
    expect(mesh!.instanceCount).toBe(0);

    batch.dispose();
    expect(batch.group.children).toHaveLength(0);

    batch.add({ object: car(0), geometry: new BoxGeometry(), material: paint });
    expect(batch.group.children).toHaveLength(1);
  });
});
