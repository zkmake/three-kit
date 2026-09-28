/**
 * What both integrations share: their options and the scene's textures.
 * One of each kind the panel handles: an image from a file (`crate`, and a clone of it tiled on
 * the small crate), a KTX2 compressed atlas cut into four sticker cards (clones with their own
 * offsets), and a data texture (`noise`).
 */
import {
  ClampToEdgeWrapping,
  DataTexture,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  type WebGLRenderer,
} from "three";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

import type { Demo, DemoBase } from "../../scripts/demo-page.ts";

type DemoOptions = DemoBase & {
  /** Storage key prefix shared by both integrations, so docks and swaps carry over. */
  storageKey: string;
};

type DemoFactory = (host: HTMLElement, options: DemoOptions) => Promise<Demo>;

type SceneTextures = {
  crate: Texture;
  /** The crate's pixels tiled 2×2: a clone, so a swap of `crate` reaches it too. */
  crateTiled: Texture;
  /** One per sticker, top-left, top-right, bottom-left, bottom-right: clones of the KTX2 atlas. */
  stickers: [Texture, Texture, Texture, Texture];
  noise: Texture;
  dispose: () => void;
};

/** A seeded pattern, so the data texture looks the same on every visit. */
const noiseTexture = () => {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const wave = Math.sin(x * 0.35) * Math.cos(y * 0.28) * 0.5 + 0.5;
      const v = wave * 0.75 + random() * 0.25;

      data.set([40 + v * 90, 90 + v * 140, 150 + v * 105, 255], (y * size + x) * 4);
    }
  }

  const texture = new DataTexture(data, size, size);

  texture.name = "noise";
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;

  return texture;
};

/**
 * A sticker's corner of the atlas. KTX2 stores the image top row first and can't be flipped on
 * upload, while a plane's uvs expect a `flipY` image, so v runs downward: repeat −½, offset from
 * the bottom of the tile.
 */
const sticker = (atlas: Texture, column: number, row: number) => {
  const texture = atlas.clone();

  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.repeat.set(0.5, -0.5);
  texture.offset.set(column * 0.5, row * 0.5 + 0.5);
  texture.needsUpdate = true;

  return texture;
};

const loadTextures = async (renderer: WebGLRenderer): Promise<SceneTextures> => {
  // No transcoder path: three's KTX2Loader finds its Basis transcoder by `import.meta.url`, and
  // Vite bundles it.
  const ktx2 = new KTX2Loader().detectSupport(renderer);
  const [crate, atlas] = await Promise.all([
    new TextureLoader().loadAsync("/three-textures/textures/crate.webp"),
    ktx2.loadAsync("/three-textures/textures/stickers.ktx2"),
  ]);

  ktx2.dispose();
  crate.name = "crate";
  crate.colorSpace = SRGBColorSpace;
  crate.anisotropy = 8;
  atlas.name = "stickers";

  const crateTiled = crate.clone();

  crateTiled.wrapS = crateTiled.wrapT = RepeatWrapping;
  crateTiled.repeat.set(2, 2);

  const stickers: SceneTextures["stickers"] = [
    sticker(atlas, 0, 0),
    sticker(atlas, 1, 0),
    sticker(atlas, 0, 1),
    sticker(atlas, 1, 1),
  ];
  const noise = noiseTexture();

  return {
    crate,
    crateTiled,
    stickers,
    noise,
    dispose: () => {
      for (const texture of [crate, crateTiled, atlas, ...stickers, noise]) {
        texture.dispose();
      }
    },
  };
};

/** Where the four sticker cards stand: a 2×2 fan to the right of the crates. */
const STICKER_SPOTS: [number, number, number][] = [
  [1.7, 1.55, -0.12],
  [2.75, 1.55, 0.12],
  [1.7, 0.45, 0.12],
  [2.75, 0.45, -0.12],
];

export { loadTextures, STICKER_SPOTS };
export type { DemoFactory, DemoOptions, SceneTextures };
