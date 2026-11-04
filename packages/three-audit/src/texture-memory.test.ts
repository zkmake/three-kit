import {
  BoxGeometry,
  CompressedTexture,
  CubeTexture,
  DataTexture,
  FloatType,
  HalfFloatType,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  RedFormat,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Texture,
} from "three";
import { describe, expect, test } from "vitest";

import { MODEL_IMAGES, textureMemory } from "./texture-memory.ts";

const image = (width: number, height: number) => ({ width, height });

const texture = (name: string, width: number, height: number) => {
  const out = new Texture(image(width, height) as never);

  out.name = name;

  return out;
};

const mesh = (material: MeshBasicMaterial | MeshStandardMaterial | ShaderMaterial) =>
  new Mesh(new BoxGeometry(), material);

describe("textureMemory", () => {
  test("RGBA8 with mipmaps: width × height × 4 × 4/3, most bytes first", () => {
    const scene = new Scene();

    scene.add(
      mesh(new MeshBasicMaterial({ map: texture("small", 256, 256), name: "a" })),
      mesh(new MeshStandardMaterial({ map: texture("big", 1024, 1024), name: "b" })),
    );

    const memory = textureMemory(scene);

    expect(memory.rows.map((row) => row.texture)).toEqual(["big", "small"]);
    expect(memory.rows[0]).toMatchObject({
      size: "1024×1024",
      format: "RGBA8",
      bytes: Math.round((1024 * 1024 * 4 * 4) / 3),
      materials: ["b"],
    });
    expect(memory.bytes).toBe(memory.rows[0]!.bytes + memory.rows[1]!.bytes);
    expect(memory.megabytes).toBeCloseTo(5.67, 2);
    expect(memory.rows[0]!.share).toBeCloseTo(0.94, 2);
    expect(memory.unknown).toBe(0);
  });

  test("no mipmaps: the base level alone", () => {
    const scene = new Scene();
    const plain = texture("plain", 100, 100);

    plain.generateMipmaps = false;
    scene.add(mesh(new MeshBasicMaterial({ map: plain })));

    const nearest = texture("nearest", 100, 100);

    nearest.minFilter = NearestFilter;
    nearest.magFilter = NearestFilter;
    scene.add(mesh(new MeshBasicMaterial({ map: nearest })));

    const linear = texture("linear", 100, 100);

    linear.minFilter = LinearFilter;
    scene.add(mesh(new MeshBasicMaterial({ map: linear })));

    expect(textureMemory(scene).rows.map((row) => row.bytes)).toEqual([40_000, 40_000, 40_000]);
  });

  test("formats and types", () => {
    const scene = new Scene();
    const half = new DataTexture(new Uint16Array(4 * 16), 4, 4, RGBAFormat, HalfFloatType);
    const float = new DataTexture(new Float32Array(16), 4, 4, RedFormat, FloatType);

    half.name = "half";
    float.name = "float";
    scene.add(
      mesh(new MeshBasicMaterial({ map: half })),
      mesh(new MeshBasicMaterial({ map: float })),
    );

    expect(textureMemory(scene).rows.map((row) => [row.texture, row.format, row.bytes])).toEqual([
      ["half", "RGBA16F", 128],
      ["float", "R32F", 64],
    ]);
  });

  test("compressed: what's stored; cube maps: six faces", () => {
    const scene = new Scene();
    const packed = new CompressedTexture(
      [{ data: new Uint8Array(1000), width: 64, height: 64 }] as never,
      64,
      64,
    );

    packed.name = "packed";

    const cube = new CubeTexture(Array.from({ length: 6 }, () => image(16, 16)) as never);

    cube.name = "cube";
    cube.generateMipmaps = false;
    scene.add(
      mesh(new MeshBasicMaterial({ map: packed })),
      mesh(new MeshBasicMaterial({ envMap: cube })),
    );

    expect(textureMemory(scene).rows.map((row) => [row.texture, row.format, row.bytes])).toEqual([
      ["cube", "RGBA8", 6 * 16 * 16 * 4],
      ["packed", "compressed", 1000],
    ]);
  });

  test("copies of one source upload once; a material's every slot and uniforms count", () => {
    const scene = new Scene();
    const base = texture("base", 64, 64);
    const copy = base.clone();

    scene.add(
      mesh(new MeshStandardMaterial({ map: base, normalMap: texture("normal", 32, 32) })),
      mesh(new MeshBasicMaterial({ map: copy })),
      mesh(
        new ShaderMaterial({
          uniforms: {
            atlas: { value: texture("atlas", 16, 16) },
            list: { value: [texture("listed", 8, 8)] },
          },
        }),
      ),
    );

    expect(textureMemory(scene).rows.map((row) => row.texture)).toEqual([
      "base",
      "normal",
      "atlas",
      "listed",
    ]);
  });

  test("the scene's background and environment; an image still loading is counted apart", () => {
    const scene = new Scene();

    scene.background = texture("sky", 8, 8);
    scene.environment = texture("env", 8, 8);
    scene.add(mesh(new MeshBasicMaterial({ map: new Texture() })));

    const memory = textureMemory(scene);

    expect(memory.rows.map((row) => row.texture).sort()).toEqual(["env", "sky"]);
    expect(memory.unknown).toBe(1);
  });

  test("hidden meshes count; skip doesn't", () => {
    const scene = new Scene();
    const hidden = mesh(new MeshBasicMaterial({ map: texture("kept", 8, 8) }));

    hidden.visible = false;
    hidden.name = "hidden";
    scene.add(hidden);

    expect(textureMemory(scene).rows).toHaveLength(1);
    expect(textureMemory(scene, { skip: (object) => object.name === "hidden" }).rows).toEqual([]);
  });

  test("a model's images, as the CLI found them", () => {
    const scene = new Scene();

    scene.userData[MODEL_IMAGES] = [
      { name: "city.png", width: 512, height: 512, format: "RGBA8", bytesPerPixel: 4 },
      { name: "far.ktx2", width: 512, height: 512, format: "compressed", bytesPerPixel: 1 },
    ];

    const memory = textureMemory(scene);

    expect(memory.rows.map((row) => [row.texture, row.bytes])).toEqual([
      ["city.png", Math.round((512 * 512 * 4 * 4) / 3)],
      ["far.ktx2", Math.round((512 * 512 * 4) / 3)],
    ]);
    expect(() => JSON.stringify(memory)).not.toThrow();
  });
});
