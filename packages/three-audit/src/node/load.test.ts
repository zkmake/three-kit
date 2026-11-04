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

  test("a meshopt file with a fallback buffer, as gltf-transform and three's bakes write", async () => {
    const { MeshoptEncoder } = await import("meshoptimizer");

    await MeshoptEncoder.ready;

    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1]);
    const encoded = MeshoptEncoder.encodeGltfBuffer(
      new Uint8Array(positions.buffer),
      6,
      12,
      "ATTRIBUTES",
    );
    const json = new TextEncoder().encode(
      JSON.stringify({
        asset: { version: "2.0" },
        extensionsUsed: ["EXT_meshopt_compression"],
        extensionsRequired: ["EXT_meshopt_compression"],
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "plate", mesh: 0 }],
        meshes: [{ name: "plate", primitives: [{ attributes: { POSITION: 0 } }] }],
        accessors: [
          {
            bufferView: 0,
            componentType: 5126,
            count: 6,
            type: "VEC3",
            min: [0, 0, 0],
            max: [1, 0, 1],
          },
        ],
        bufferViews: [
          {
            buffer: 1,
            byteLength: 72,
            byteStride: 12,
            extensions: {
              EXT_meshopt_compression: {
                buffer: 0,
                byteLength: encoded.byteLength,
                byteStride: 12,
                mode: "ATTRIBUTES",
                count: 6,
              },
            },
          },
        ],
        buffers: [
          { byteLength: encoded.byteLength },
          { byteLength: 72, extensions: { EXT_meshopt_compression: { fallback: true } } },
        ],
      }),
    );
    const jsonLength = Math.ceil(json.byteLength / 4) * 4;
    const binLength = Math.ceil(encoded.byteLength / 4) * 4;
    const out = new Uint8Array(28 + jsonLength + binLength);
    const view = new DataView(out.buffer);

    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, out.byteLength, true);
    view.setUint32(12, jsonLength, true);
    view.setUint32(16, 0x4e4f534a, true);
    out.fill(0x20, 20, 20 + jsonLength);
    out.set(json, 20);
    view.setUint32(20 + jsonLength, binLength, true);
    view.setUint32(24 + jsonLength, 0x004e4942, true);
    out.set(encoded, 28 + jsonLength);

    const scene = await parseModel(out);

    expect(countTriangles(scene)).toBe(2);
    expect((scene.getObjectByName("plate") as Mesh).geometry.attributes.position!.getX(1)).toBe(1);
  });

  test("lists the images it strips, by their headers, from a file beside a .gltf", async () => {
    const directory = await mkdtemp(join(tmpdir(), "three-audit-images-"));
    const png = new Uint8Array(24);

    png.set([0x89, 0x50, 0x4e, 0x47]);
    new DataView(png.buffer).setUint32(16, 256);
    new DataView(png.buffer).setUint32(20, 128);
    await writeFile(join(directory, "sign.png"), png);

    const { json, bytes } = gltfJson([{ name: "sign", y: 0 }], {
      textured: true,
      image: "sign.png",
    });

    await writeFile(join(directory, "bin.bin"), bytes);
    (json.buffers as { uri?: string }[])[0]!.uri = "bin.bin";

    const scene = await parseModel(new TextEncoder().encode(JSON.stringify(json)), directory);

    expect(scene.userData.threeAuditImages).toEqual([
      { name: "sign.png", width: 256, height: 128, format: "RGBA8", bytesPerPixel: 4 },
    ]);
  });
});
