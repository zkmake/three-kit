/**
 * What a scene's textures cost on the GPU, worked out from their sizes and formats: no renderer and
 * nothing uploaded. Hidden objects count, since what's uploaded stays uploaded. A texture that only
 * a node material's graph uses can't be found this way.
 */
import type { Material, Object3D, Scene, Texture } from "three";

import { textureName } from "./color-issues.ts";
import { type AnyObject3D, asObject3D, isDrawable, materialsOf, type Skip, walk } from "./scene.ts";

export type TextureMemoryOptions = { skip?: Skip | undefined };

export type TextureRow = {
  /** Its name, else the file or canvas it came from. */
  texture: string;
  /** `2048×2048`. */
  size: string;
  /** `RGBA8`, `RGBA16F`, `compressed`… */
  format: string;
  /** Bytes on the GPU, mipmaps included. */
  bytes: number;
  /** Its share of the whole, 0 to 1. */
  share: number;
  /** Materials that use it. */
  materials: string[];
  /** Not enumerable: kept out of JSON and `console.table`. */
  readonly object: Texture | null;
};

export type TextureMemory = {
  /** Bytes on the GPU, mipmaps included. */
  bytes: number;
  /** The same in MB (1024²), to two places: what `frame.textureMB` is measured against. */
  megabytes: number;
  /** Textures, most bytes first. Copies sharing one source upload once and count once. */
  rows: TextureRow[];
  /** Textures with no size yet (an image still loading), so left out of the sum. */
  unknown: number;
};

/** An image the CLI found in a model file: textures don't load in Node, so `parseModel` lists them. */
export type ModelImage = {
  name: string;
  width: number;
  height: number;
  /** `RGBA8`, or `compressed` for a GPU format. */
  format: string;
  /** Bytes per pixel on the GPU, before mipmaps. */
  bytesPerPixel: number;
};

/** `userData` key `parseModel` lists a model's images under. */
export const MODEL_IMAGES = "threeAuditImages";

// three's constants, by value: nothing here imports three at runtime.
const FORMATS: Record<number, { name: string; channels: number }> = {
  1021: { name: "A", channels: 1 },
  1023: { name: "RGBA", channels: 4 },
  1028: { name: "R", channels: 1 },
  1030: { name: "RG", channels: 2 },
  1022: { name: "RGB", channels: 4 },
};
const TYPES: Record<number, { name: string; bytes: number }> = {
  1009: { name: "8", bytes: 1 },
  1010: { name: "8", bytes: 1 },
  1011: { name: "16", bytes: 2 },
  1012: { name: "16", bytes: 2 },
  1013: { name: "32", bytes: 4 },
  1014: { name: "32", bytes: 4 },
  1015: { name: "32F", bytes: 4 },
  1016: { name: "16F", bytes: 2 },
};
const LINEAR_MIPMAP_MIN_FILTERS = new Set([1004, 1005, 1007, 1008]);

const round = (value: number, places = 2) => {
  const scale = 10 ** places;

  return Math.round(value * scale) / scale;
};

type Sized = {
  width?: number;
  height?: number;
  depth?: number;
  videoWidth?: number;
  videoHeight?: number;
};

const sizeOf = (image: unknown) => {
  const sized = (Array.isArray(image) ? (image[0] as unknown) : image) as Sized | null | undefined;
  const width = sized?.width ?? sized?.videoWidth;
  const height = sized?.height ?? sized?.videoHeight;

  return width && height ? { width, height, depth: sized?.depth ?? 1 } : null;
};

/** Bytes a texture takes, and how to describe it; `null` when its image has no size yet. */
const measure = (texture: Texture) => {
  const { image } = texture;
  const faces = (texture as { isCubeTexture?: boolean }).isCubeTexture === true ? 6 : 1;
  const compressed = (texture as { isCompressedTexture?: boolean }).isCompressedTexture === true;
  const mipmaps = texture.mipmaps as { data?: { byteLength?: number } }[] | undefined;

  if (compressed && mipmaps?.[0]?.data?.byteLength !== undefined) {
    const stored = mipmaps.reduce((sum, level) => sum + (level.data?.byteLength ?? 0), 0);
    const size = sizeOf(image) ?? sizeOf(mipmaps[0]);

    return {
      size: size ? `${size.width}×${size.height}` : "?",
      format: "compressed",
      bytes: stored * faces,
    };
  }

  const size = sizeOf(image);

  if (!size) {
    return null;
  }

  const format = FORMATS[texture.format as number] ?? { name: "RGBA", channels: 4 };
  const type = TYPES[texture.type as number] ?? { name: "8", bytes: 1 };
  const base = size.width * size.height * size.depth * format.channels * type.bytes * faces;
  const mipped =
    texture.generateMipmaps === true && LINEAR_MIPMAP_MIN_FILTERS.has(texture.minFilter as number);

  return {
    size: `${size.width}×${size.height}${size.depth > 1 ? `×${size.depth}` : ""}`,
    format: `${format.name}${type.name}`,
    bytes: Math.round(mipped ? (base * 4) / 3 : base),
  };
};

/** Textures a material holds: in any property (its slots), and in a shader's uniforms. */
const texturesOf = (material: Material) => {
  const found: Texture[] = [];
  const add = (value: unknown) => {
    if ((value as Texture | null | undefined)?.isTexture === true) {
      found.push(value as Texture);
    }
  };

  for (const value of Object.values(material)) {
    add(value);
  }

  const { uniforms } = material as { uniforms?: Record<string, { value?: unknown }> };

  for (const uniform of Object.values(uniforms ?? {})) {
    if (Array.isArray(uniform?.value)) {
      uniform.value.forEach(add);
    } else {
      add(uniform?.value);
    }
  }

  return found;
};

/** What the scene's textures cost on the GPU. */
export const textureMemory = (
  scene: AnyObject3D,
  options: TextureMemoryOptions = {},
): TextureMemory => {
  const root = asObject3D(scene);
  const uses = new Map<object, { texture: Texture; materials: Set<string> }>();
  const unknown = new Set<object>();
  const seen = new Set<Material>();
  const add = (texture: Texture, material?: Material) => {
    const key = (texture.source as object | undefined) ?? texture;
    const known = uses.get(key) ?? { texture, materials: new Set<string>() };

    if (material) {
      known.materials.add(material.name || material.type);
    }

    uses.set(key, known);
  };

  walk(root, { skip: options.skip }, (object: Object3D) => {
    if (!isDrawable(object)) {
      return;
    }

    for (const material of materialsOf(object as never)) {
      if (!seen.has(material)) {
        seen.add(material);
        texturesOf(material).forEach((texture) => add(texture, material));
      }
    }
  });

  const { background, environment } = root as Scene;

  for (const value of [background, environment]) {
    if ((value as Texture | null | undefined)?.isTexture === true) {
      add(value as Texture);
    }
  }

  const rows: (Omit<TextureRow, "object"> & { object?: Texture })[] = [];

  for (const [key, { texture, materials }] of uses) {
    const measured = measure(texture);

    if (!measured) {
      unknown.add(key);
    } else {
      rows.push({
        texture: textureName(texture),
        ...measured,
        share: 0,
        materials: [...materials],
        object: texture,
      });
    }
  }

  for (const image of (root.userData[MODEL_IMAGES] ?? []) as ModelImage[]) {
    rows.push({
      texture: image.name,
      size: `${image.width}×${image.height}`,
      format: image.format,
      bytes: Math.round((image.width * image.height * image.bytesPerPixel * 4) / 3),
      share: 0,
      materials: [],
    });
  }

  const bytes = rows.reduce((sum, row) => sum + row.bytes, 0);

  return {
    bytes,
    megabytes: round(bytes / 1024 ** 2),
    rows: rows
      .sort((a, b) => b.bytes - a.bytes)
      .map(
        ({ object, ...row }) =>
          Object.defineProperty(
            { ...row, share: bytes > 0 ? round(row.bytes / bytes) : 0 },
            "object",
            {
              value: object ?? null,
              enumerable: false,
            },
          ) as TextureRow,
      ),
    unknown: unknown.size,
  };
};
