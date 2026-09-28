import {
  BoxGeometry,
  ClampToEdgeWrapping,
  CompressedTexture,
  CubeTexture,
  DataTexture,
  type Material,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  RGBA_ASTC_4x4_Format,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
} from "three";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { findTextures } from "./discover.ts";
import { TextureLab } from "./lab.ts";
import { memoryStore } from "./store.ts";

/** Node has no image decoding: a stand-in that "decodes" to a 4×4 image. */
class FakeImage {
  src = "";
  width = 4;
  height = 4;
  decode() {
    return Promise.resolve();
  }
}

beforeAll(() => {
  vi.stubGlobal("Image", FakeImage);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const png = (name = "painted.png") =>
  new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });

const imageTexture = (src: string) => {
  const texture = new Texture({ width: 8, height: 8, src } as unknown as HTMLImageElement);

  texture.colorSpace = SRGBColorSpace;

  return texture;
};

const compressed = () => {
  const texture = new CompressedTexture(
    [{ data: new Uint8Array(16), width: 4, height: 4 }] as never,
    4,
    4,
    RGBA_ASTC_4x4_Format,
  );

  texture.name = "atlas";
  texture.flipY = false;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.channel = 1;
  texture.colorSpace = SRGBColorSpace;
  texture.repeat.set(2, 3);

  return texture;
};

const mesh = (material: Material) => new Mesh(new BoxGeometry(), material);

describe("findTextures", () => {
  test("slots, uniforms and background, grouped by source, shared materials read once", () => {
    const wood = imageTexture("/assets/wood-AbCd1234.webp");
    const clone = wood.clone();
    const shader = new ShaderMaterial({ uniforms: { tNoise: { value: clone } } });
    const shared = new MeshStandardMaterial({ map: wood });
    const scene = new Scene().add(mesh(shared), mesh(shared), mesh(shader));
    const background = imageTexture("/sky.png");

    Object.assign(shared, { detailMap: imageTexture("/detail.png") });
    scene.background = background;

    const found = findTextures(scene);
    const woodFound = found.get(wood.source)!;

    expect(found.size).toBe(3);
    expect([...woodFound.textures]).toEqual([wood, clone]);
    expect(woodFound.refs).toHaveLength(2);
    expect(woodFound.materials.size).toBe(2);
    expect(found.get(background.source)!.slots).toEqual(new Set(["scene.background"]));
  });
});

describe("TextureLab", () => {
  test("names: registered, texture name, file stem, slot; duplicates numbered", () => {
    const named = imageTexture("/a.png");
    const registered = imageTexture("/b.png");
    const unnamed = new Texture({ width: 2, height: 2 } as never);

    named.name = "grass";

    const scene = new Scene().add(
      mesh(new MeshStandardMaterial({ map: named })),
      mesh(new MeshStandardMaterial({ map: registered })),
      mesh(new MeshStandardMaterial({ name: "hull", map: unnamed })),
      mesh(new MeshStandardMaterial({ map: imageTexture("/assets/bunny-AbCd1234.webp") })),
      mesh(new MeshStandardMaterial({ map: imageTexture("/other/bunny.webp") })),
    );
    const lab = new TextureLab({
      scene,
      store: memoryStore(),
      textures: [{ name: "Bunny baked", texture: registered, src: "/b.png" }],
    });

    expect(lab.entries().map((entry) => entry.id)).toEqual([
      "bunny",
      "bunny 2",
      "Bunny baked",
      "grass",
      "hull.map",
    ]);
    expect(lab.entry("bunny")!.format).toBe("webp");
  });

  test("an image texture swaps in place: every clone re-uploads, A/B and revert", async () => {
    const wood = imageTexture("/wood.png");
    const clone = wood.clone();
    const original = wood.source.data;
    const scene = new Scene().add(
      mesh(new MeshStandardMaterial({ map: wood })),
      mesh(new MeshStandardMaterial({ map: clone })),
    );
    const onSwap = vi.fn();
    const invalidate = vi.fn();
    const store = memoryStore();
    const lab = new TextureLab({ scene, store, onSwap, invalidate });
    const versions = () => [wood.version, clone.version];
    const before = versions();

    await lab.swap("wood", png());

    expect(wood.source.data).toBeInstanceOf(FakeImage);
    expect(versions().every((version, i) => version > before[i]!)).toBe(true);
    expect(lab.entry("wood")!).toMatchObject({ state: "swapped", swapName: "painted.png" });
    expect(onSwap).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "wood", state: "swapped", bound: [wood, clone] }),
    );
    expect(invalidate).toHaveBeenCalled();
    expect((await store.get("wood"))?.fileName).toBe("painted.png");

    await lab.showOriginal("wood", true);
    expect(wood.source.data).toBe(original);
    expect(lab.entry("wood")!.state).toBe("showing-original");
    expect((await store.get("wood"))?.showingOriginal).toBe(true);

    await lab.showOriginal("wood", false);
    expect(wood.source.data).toBeInstanceOf(FakeImage);

    await lab.revert("wood");
    expect(wood.source.data).toBe(original);
    expect(lab.entry("wood")!.state).toBe("original");
    expect(await store.get("wood")).toBeUndefined();
  });

  test("a compressed texture swaps by rebinding an image twin with its settings", async () => {
    const atlas = compressed();
    const standard = new MeshStandardMaterial({ map: atlas });
    const shader = new ShaderMaterial({ uniforms: { tAtlas: { value: atlas } } });
    const scene = new Scene().add(mesh(standard), mesh(shader));
    const lab = new TextureLab({ scene, store: memoryStore() });
    const versions = [standard.version, shader.version];

    expect(lab.entry("atlas")).toMatchObject({ kind: "compressed", format: "ASTC", width: 4 });

    await lab.swap("atlas", png());

    const twin = standard.map!;

    expect(twin).not.toBe(atlas);
    expect(shader.uniforms.tAtlas!.value).toBe(twin);
    expect((twin as { isCompressedTexture?: boolean }).isCompressedTexture).toBeUndefined();
    expect(twin.source.data).toBeInstanceOf(FakeImage);
    expect(twin).toMatchObject({
      flipY: false,
      wrapS: RepeatWrapping,
      wrapT: ClampToEdgeWrapping,
      channel: 1,
      colorSpace: SRGBColorSpace,
      name: "atlas",
    });
    expect(twin.repeat.toArray()).toEqual([2, 3]);
    expect([standard.version, shader.version]).toEqual(versions.map((v) => v + 1));

    // The twin isn't a texture of its own on the next look.
    lab.refresh();
    expect(lab.entries().map((entry) => entry.id)).toEqual(["atlas"]);

    // A mesh mounted later with the original gets the twin too.
    const late = new MeshStandardMaterial({ map: atlas });

    scene.add(mesh(late));
    lab.refresh();
    expect(late.map).toBe(twin);

    await lab.showOriginal("atlas", true);
    expect([standard.map, late.map, shader.uniforms.tAtlas!.value]).toEqual([atlas, atlas, atlas]);

    await lab.showOriginal("atlas", false);
    expect(standard.map).toBe(twin);

    const dispose = vi.fn();

    twin.addEventListener("dispose", dispose);
    await lab.revert("atlas");
    expect([standard.map, late.map, shader.uniforms.tAtlas!.value]).toEqual([atlas, atlas, atlas]);
    expect(dispose).toHaveBeenCalled();
  });

  test("a second swap over a rebind reuses the twins", async () => {
    const atlas = compressed();
    const material = new MeshStandardMaterial({ map: atlas });
    const lab = new TextureLab({ scene: new Scene().add(mesh(material)), store: memoryStore() });

    await lab.swap("atlas", png("one.png"));

    const twin = material.map!;

    await lab.showOriginal("atlas", true);
    await lab.swap("atlas", png("two.png"));
    expect(material.map).toBe(twin);
    expect(lab.entry("atlas")).toMatchObject({ state: "swapped", swapName: "two.png" });
  });

  test("a data texture rebinds too", async () => {
    const data = new DataTexture(new Uint8Array(16), 2, 2);

    data.name = "noise";

    const material = new MeshStandardMaterial({ map: data });
    const lab = new TextureLab({ scene: new Scene().add(mesh(material)), store: memoryStore() });

    await lab.swap("noise", png());
    expect(material.map).not.toBe(data);
    expect(material.map!.flipY).toBe(false);
  });

  test("a saved swap comes back on reload, A/B state included", async () => {
    const store = memoryStore();
    const first = compressed();
    const lab = new TextureLab({
      scene: new Scene().add(mesh(new MeshStandardMaterial({ map: first }))),
      store,
    });

    await lab.swap("atlas", png());
    await lab.showOriginal("atlas", true);

    // A fresh page: new textures, same names.
    const material = new MeshStandardMaterial({ map: compressed() });
    const reloaded = new TextureLab({ scene: new Scene().add(mesh(material)), store });

    await vi.waitFor(() => expect(reloaded.entry("atlas")!.state).toBe("showing-original"));
    expect(reloaded.entry("atlas")!.swapName).toBe("painted.png");
  });

  test("cube textures are listed but can't be swapped", async () => {
    const cube = new CubeTexture();

    cube.name = "sky";

    const scene = new Scene();

    scene.background = cube;

    const lab = new TextureLab({ scene, store: memoryStore() });

    expect(lab.entry("sky")!.unsupported).toMatch(/can't be swapped/);
    await expect(lab.swap("sky", png())).rejects.toThrow(/can't be swapped/);
  });

  test("download: the swapped file, else the source file, named without its bundler hash", async () => {
    const wood = imageTexture("/assets/wood-AbCd1234.webp");
    const lab = new TextureLab({
      scene: new Scene().add(mesh(new MeshStandardMaterial({ map: wood }))),
      store: memoryStore(),
    });
    const file = new Blob(["webp"]);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(file)),
    );
    expect((await lab.toBlob("wood")).fileName).toBe("wood.webp");

    await lab.swap("wood", png("wood-painted.png"));
    expect((await lab.toBlob("wood")).fileName).toBe("wood-painted.png");
    vi.stubGlobal("fetch", undefined);
    vi.stubGlobal("Image", FakeImage);
  });

  test("a texture that leaves the scene leaves the list, unless swapped", async () => {
    const a = imageTexture("/a.png");
    const b = imageTexture("/b.png");
    const meshA = mesh(new MeshStandardMaterial({ map: a }));
    const meshB = mesh(new MeshStandardMaterial({ map: b }));
    const scene = new Scene().add(meshA, meshB);
    const lab = new TextureLab({ scene, store: memoryStore() });

    await lab.swap("b", png());
    scene.remove(meshA, meshB);
    lab.refresh();
    expect(lab.entries().map((entry) => entry.id)).toEqual(["b"]);
  });
});
