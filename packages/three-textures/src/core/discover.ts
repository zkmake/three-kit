/**
 * Find every texture a scene draws with: each material's texture slots (any property holding a
 * texture, not only three's named maps), its uniforms, and the scene's background and
 * environment. Textures are grouped by their `TextureSource`, the image data they upload: clones share
 * it, so a swap has to reach all of them.
 */
import type { Material, Object3D, Texture } from "three";

/** A texture's `Source`: the image data it uploads, shared by its clones. */
export type TextureSource = Texture["source"];

/** Somewhere a texture is bound: `owner[key]`. A uniform's owner is the uniform, `{ value }`. */
export type TextureRef = {
  owner: Record<string, unknown>;
  key: string;
  /** The material to recompile after rebinding, when the owner is one of its slots or uniforms. */
  material: Material | null;
};

export type Found = {
  source: TextureSource;
  textures: Set<Texture>;
  refs: TextureRef[];
  /** `material.slot` names, for a fallback label and the "used by" count. */
  slots: Set<string>;
  materials: Set<Material>;
};

const isTexture = (value: unknown): value is Texture =>
  value !== null && typeof value === "object" && (value as Texture).isTexture === true;

const add = (found: Map<TextureSource, Found>, texture: Texture, ref: TextureRef, slot: string) => {
  let entry = found.get(texture.source);

  if (!entry) {
    entry = {
      source: texture.source,
      textures: new Set(),
      refs: [],
      slots: new Set(),
      materials: new Set(),
    };
    found.set(texture.source, entry);
  }

  entry.textures.add(texture);
  entry.refs.push(ref);
  entry.slots.add(slot);

  if (ref.material) {
    entry.materials.add(ref.material);
  }
};

const scanMaterial = (found: Map<TextureSource, Found>, material: Material) => {
  const record = material as unknown as Record<string, unknown>;
  const label = material.name || material.type;

  for (const key of Object.keys(record)) {
    const value = record[key];

    if (isTexture(value)) {
      add(found, value, { owner: record, key, material }, `${label}.${key}`);
    }
  }

  const uniforms = (material as { uniforms?: Record<string, { value?: unknown } | undefined> })
    .uniforms;

  for (const [name, uniform] of Object.entries(uniforms ?? {})) {
    if (uniform && isTexture(uniform.value)) {
      add(found, uniform.value, { owner: uniform, key: "value", material }, `${label}.${name}`);
    }
  }
};

/** Every texture under `root`, grouped by source. Materials shared by many meshes are read once. */
export const findTextures = (root: Object3D): Map<TextureSource, Found> => {
  const found = new Map<TextureSource, Found>();
  const seen = new Set<Material>();
  const scene = root as unknown as Record<string, unknown>;

  for (const key of ["background", "environment"]) {
    const value = scene[key];

    if (isTexture(value)) {
      add(found, value, { owner: scene, key, material: null }, `scene.${key}`);
    }
  }

  root.traverse((object) => {
    const held = (object as { material?: Material | Material[] }).material;

    for (const material of Array.isArray(held) ? held : held ? [held] : []) {
      if (!seen.has(material)) {
        seen.add(material);
        scanMaterial(found, material);
      }
    }
  });

  return found;
};
