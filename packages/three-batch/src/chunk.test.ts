import {
  BoxGeometry,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from "three";
import { describe, expect, test } from "vitest";

import { chunkGeometry, chunkInstances, chunkMesh, disposeChunks } from "./chunk.ts";

const material = new MeshBasicMaterial();

/** One instance at each (x, z), coloured by its order. */
const scatter = (points: [number, number][]) => {
  const mesh = new InstancedMesh(new BoxGeometry(), material, points.length);

  mesh.name = "rocks";
  mesh.castShadow = true;
  points.forEach(([x, z], i) => {
    mesh.setMatrixAt(i, new Matrix4().makeTranslation(x, 0, z));
    mesh.setColorAt(i, new Color(i / 10, 0, 0));
  });

  return mesh;
};

describe("chunkInstances", () => {
  test("splits into grid cells, keeping matrices, colours and flags", () => {
    const mesh = scatter([
      [1, 1],
      [2, 3],
      [15, 1],
      [1, 15],
      [-1, -1],
    ]);

    mesh.position.set(100, 0, 0);

    const group = chunkInstances(mesh, { size: 10 });
    const cells = group.children as InstancedMesh[];

    expect(group.position.x).toBe(100);
    expect(cells.map((cell) => [cell.name, cell.count])).toEqual([
      ["rocks#0,0", 2],
      ["rocks#1,0", 1],
      ["rocks#0,1", 1],
      ["rocks#-1,-1", 1],
    ]);
    expect(cells.every((cell) => cell.castShadow && cell.geometry === mesh.geometry)).toBe(true);

    const matrix = new Matrix4();
    const colour = new Color();

    cells[0]!.getMatrixAt(1, matrix);
    cells[0]!.getColorAt(1, colour);
    expect([matrix.elements[12], matrix.elements[14]]).toEqual([2, 3]);
    expect(colour.r).toBeCloseTo(0.1);
    expect(cells[1]!.boundingSphere!.center.x).toBeCloseTo(15);
  });

  test("strips along one axis", () => {
    const group = chunkInstances(
      scatter([
        [1, 1],
        [1, 50],
        [12, 1],
      ]),
      { size: 10, axes: "x" },
    );

    expect(group.children.map((cell) => cell.name)).toEqual(["rocks#0", "rocks#1"]);
  });

  test("refuses per-instance geometry attributes", () => {
    const mesh = scatter([[0, 0]]);

    mesh.geometry.setAttribute("fade", new InstancedBufferAttribute(new Float32Array(1), 1));
    expect(() => chunkInstances(mesh, { size: 10 })).toThrow(/"fade" is a per-instance/);
  });
});

describe("chunkGeometry", () => {
  test("bins triangles by their middle and shares the vertex buffers", () => {
    const ground = new PlaneGeometry(40, 40, 4, 4).rotateX(-Math.PI / 2);

    ground.name = "ground";

    const pieces = chunkGeometry(ground, { size: 20 });

    expect(pieces).toHaveLength(4);
    expect(pieces.reduce((sum, piece) => sum + piece.index!.count, 0)).toBe(ground.index!.count);
    expect(pieces.every((piece) => piece.attributes.position === ground.attributes.position)).toBe(
      true,
    );
    expect(pieces[0]!.name).toMatch(/^ground#-?\d+,-?\d+$/);
    expect(pieces[0]!.boundingSphere!.radius).toBeLessThan(15);
  });

  test("chunkMesh keeps the material and transform", () => {
    const mesh = new Mesh(new PlaneGeometry(40, 40, 4, 4).rotateX(-Math.PI / 2), material);

    mesh.name = "plain";
    mesh.position.y = -1;

    const group = chunkMesh(mesh, { size: 20, axes: "x" });

    expect(group.position.y).toBe(-1);
    expect(group.children.map((piece) => piece.name).sort()).toEqual(["plain#-1", "plain#0"]);
    expect((group.children[0] as Mesh).material).toBe(material);

    disposeChunks(group);
  });
});
