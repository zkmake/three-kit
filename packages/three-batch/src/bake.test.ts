import {
  BoxGeometry,
  BufferAttribute,
  Group,
  InstancedMesh,
  type Material,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from "three";
import { describe, expect, test } from "vitest";

import { bake, bakePiles } from "./bake.ts";

const wood = new MeshStandardMaterial({ name: "wood" });
const iron = new MeshStandardMaterial({ name: "iron" });

const part = (material: Material, x: number, name = "") => {
  const mesh = new Mesh(new BoxGeometry(), material);

  mesh.position.x = x;
  mesh.name = name;

  return mesh;
};

describe("bakePiles", () => {
  test("one pile per material, in the root's frame", () => {
    const root = new Group();
    const arm = new Group();

    root.position.set(100, 0, 0);
    arm.position.set(0, 10, 0);
    arm.add(part(wood, 1));
    root.add(part(wood, 0), part(iron, 0), arm);

    const { piles, sources } = bakePiles(root);

    expect(
      piles.map((pile) => [pile.material.name, pile.geometry.attributes.position!.count]),
    ).toEqual([
      ["wood", 72],
      ["iron", 36],
    ]);
    expect(sources).toHaveLength(3);

    piles[0]!.geometry.computeBoundingBox();
    // The arm's box sits at (1, 10, 0) in the root's frame; the root's own offset isn't applied.
    expect(piles[0]!.geometry.boundingBox!.max.toArray()).toEqual([1.5, 10.5, 0.5]);
  });

  test("leaves out hidden subtrees, instanced meshes, text, skipped and baked objects", () => {
    const root = new Group();
    const hidden = new Group();
    const text = part(wood, 0);
    const merged = part(wood, 0);

    hidden.visible = false;
    hidden.add(part(wood, 0));
    Object.assign(text, { textRenderInfo: {} });
    merged.userData.bakedResult = true;
    root.add(
      hidden,
      text,
      merged,
      new InstancedMesh(new BoxGeometry(), wood, 3),
      part(wood, 0, "keep"),
      part(wood, 0, "skip-me"),
    );

    const { sources } = bakePiles(root, { skip: (object) => object.name === "skip-me" });

    expect(sources.map((source) => source.name)).toEqual(["keep"]);
  });

  test("a mirrored part is re-wound to face outward", () => {
    const root = new Group();
    const mirrored = new Mesh(new PlaneGeometry(), wood);

    mirrored.scale.x = -1;
    root.add(mirrored);

    const [pile] = bakePiles(root).piles;
    const position = pile!.geometry.attributes.position!;
    const [a, b, c] = [0, 1, 2].map((i) => new Vector3().fromBufferAttribute(position, i));
    const facing = new Vector3().subVectors(b!, a!).cross(new Vector3().subVectors(c!, a!));

    // Winding agrees with the plane's +z normal again.
    expect(facing.z).toBeGreaterThan(0);
    expect(pile!.geometry.attributes.normal!.getZ(0)).toBeCloseTo(1);
  });

  test("keeps only shared attributes, or those asked for", () => {
    const root = new Group();
    const bare = part(wood, 0);

    bare.geometry.deleteAttribute("uv");
    root.add(part(wood, 1), bare);
    expect(Object.keys(bakePiles(root).piles[0]!.geometry.attributes).sort()).toEqual([
      "normal",
      "position",
    ]);

    const other = new Group().add(part(wood, 0));

    expect(
      Object.keys(bakePiles(other, { keep: ["position"] }).piles[0]!.geometry.attributes),
    ).toEqual(["position"]);
  });

  test("folds many materials into one pile", () => {
    const shared = new MeshStandardMaterial({ name: "paint", vertexColors: true });
    const red = new MeshStandardMaterial({ color: "red" });
    const blue = new MeshStandardMaterial({ color: "blue" });
    const root = new Group().add(part(red, 0), part(blue, 2));

    const { piles } = bakePiles(root, {
      keep: ["position", "normal"],
      fold: (material, geometry) => {
        const { r, g, b } = (material as MeshStandardMaterial).color;
        const count = geometry.attributes.position!.count;

        geometry.setAttribute(
          "color",
          new BufferAttribute(
            new Float32Array(count * 3).map((_, i) => [r, g, b][i % 3]!),
            3,
          ),
        );

        return shared;
      },
    });

    expect(piles).toHaveLength(1);
    expect(piles[0]!.material).toBe(shared);
    expect(piles[0]!.geometry.attributes.color!.getX(0)).toBe(1);
    expect(piles[0]!.geometry.attributes.color!.getZ(40)).toBe(1);
  });
});

describe("bake", () => {
  test("adds the merged meshes, hides the parts, and undoes both", () => {
    const root = new Group().add(part(wood, 0), part(wood, 2), part(iron, 4));

    root.name = "shed";

    const undo = bake(root);
    const merged = root.children.filter((child) => child.userData.bakedResult === true);

    expect(merged.map((mesh) => mesh.name)).toEqual(["shed:wood", "shed:iron"]);
    expect(root.children.filter((child) => child.visible)).toHaveLength(2);

    // Baking again leaves the merged meshes alone.
    expect(bakePiles(root).sources).toHaveLength(0);

    undo();
    expect(root.children).toHaveLength(3);
    expect(root.children.every((child) => child.visible)).toBe(true);
  });
});
