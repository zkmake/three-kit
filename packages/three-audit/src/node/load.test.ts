import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Mesh } from "three";
import { describe, expect, test } from "vitest";

import { glb, gltfJson } from "../../tests/gltf.ts";
import { countTriangles } from "../triangles.ts";
import { findZFighting } from "../z-fighting.ts";
import { loadModel, parseModel } from "./load.ts";

const fixture = (name: string) => new URL(`../../tests/fixtures/${name}`, import.meta.url).pathname;

describe("loadModel", () => {
  test("a GLB, with its textures stripped before they're decoded", async () => {
    const scene = await parseModel(
      glb(
        [
          { name: "floor", y: 0 },
          { name: "rug", y: 0, size: 0.5 },
        ],
        { textured: true },
      ),
    );
    const rug = scene.getObjectByName("rug") as Mesh;

    expect(countTriangles(scene)).toBe(4);
    expect((rug.material as { map?: unknown }).map ?? null).toBeNull();
    expect(findZFighting(scene).map((row) => [row.a.split(" ")[0], row.b.split(" ")[0]])).toEqual([
      ["floor", "rug"],
    ]);
  });

  test("a .gltf with its buffer in a separate file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "three-audit-"));
    const { json, bytes } = gltfJson([{ name: "floor", y: 0 }]);

    (json.buffers as { uri?: string }[])[0]!.uri = "floor data.bin";
    await writeFile(join(directory, "floor data.bin"), bytes);
    await writeFile(join(directory, "floor.gltf"), JSON.stringify(json));

    expect(countTriangles(await loadModel(join(directory, "floor.gltf")))).toBe(2);
  });

  test("a real exported model", async () => {
    const scene = await loadModel(fixture("tile.glb"));

    expect(countTriangles(scene)).toBe(108);
    expect(findZFighting(scene)).toEqual([]);
  });

  test("a Draco-compressed model, through draco3dgltf", async () => {
    const scene = await loadModel(fixture("draco-hint.glb"));

    expect(countTriangles(scene)).toBeGreaterThan(0);

    scene.traverse((object) => {
      const mesh = object as Mesh;

      if (mesh.isMesh) {
        expect(Number.isFinite(mesh.geometry.attributes.position!.getX(0))).toBe(true);
      }
    });
  });

  test("bytes that aren't glTF fail clearly", async () => {
    await expect(parseModel(new TextEncoder().encode("not json"))).rejects.toThrow();
  });
});
