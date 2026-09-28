/**
 * Put an image in place of a texture's pixels, and take it out again.
 *
 * - **In place**, for an image texture: the shared `Source` gets the new image and every texture
 *   on it re-uploads. Anything holding the texture — materials, the app's own references — sees
 *   the swap, and the texture keeps all its settings.
 * - **Rebind**, for compressed and data textures: their data is GPU-ready blocks or raw bytes, so
 *   an image can't go in their place. Each gets an image twin with its settings (wrap, filters,
 *   colour space, uv channel and transform) and the twin is bound wherever the original was: the
 *   material slots and uniforms `findTextures` saw. `flipY` is off, the way compressed and data
 *   textures lay their rows, so a readback of the original uploads back the same way up.
 */
import { type Material, Texture } from "three";

import type { Found, TextureRef, TextureSource } from "./discover.ts";
import type { TextureKind } from "./kinds.ts";

export type SwapImage = HTMLImageElement | ImageBitmap;

/** One slot the swap rebound: which original it held and the twin that replaced it. */
type Binding = TextureRef & { original: Texture; twin: Texture };

export type Applied =
  | {
      mode: "in-place";
      image: SwapImage;
      showingOriginal: boolean;
      /** The source's data before the first swap. */
      original: unknown;
      textures: Set<Texture>;
    }
  | {
      mode: "rebind";
      image: SwapImage;
      showingOriginal: boolean;
      /** The twins' shared source, holding the swapped image. */
      source: TextureSource;
      twins: Map<Texture, Texture>;
      bindings: Binding[];
    };

export const canSwap = (kind: TextureKind) => kind !== "unsupported";

const bump = (textures: Iterable<Texture>) => {
  for (const texture of textures) {
    texture.needsUpdate = true;
  }
};

const recompile = (materials: Iterable<Material | null>) => {
  for (const material of materials) {
    if (material) {
      material.needsUpdate = true;
    }
  }
};

const twinOf = (original: Texture, source: TextureSource) => {
  const twin = new Texture();

  twin.source = source;
  twin.name = original.name;
  twin.mapping = original.mapping;
  twin.channel = original.channel;
  twin.wrapS = original.wrapS;
  twin.wrapT = original.wrapT;
  twin.magFilter = original.magFilter;
  twin.minFilter = original.minFilter;
  twin.anisotropy = original.anisotropy;
  twin.colorSpace = original.colorSpace;
  twin.offset.copy(original.offset);
  twin.repeat.copy(original.repeat);
  twin.center.copy(original.center);
  twin.rotation = original.rotation;
  twin.matrixAutoUpdate = original.matrixAutoUpdate;
  twin.matrix.copy(original.matrix);
  twin.userData = { ...original.userData };
  twin.flipY = false;
  twin.premultiplyAlpha = false;
  twin.generateMipmaps = true;
  twin.needsUpdate = true;

  return twin;
};

/** Bind twins into every ref that still holds an original. Returns the new bindings. */
const bindRefs = (refs: readonly TextureRef[], twins: Map<Texture, Texture>): Binding[] => {
  const made: Binding[] = [];

  for (const ref of refs) {
    const original = ref.owner[ref.key] as Texture;
    const twin = twins.get(original);

    if (twin) {
      ref.owner[ref.key] = twin;
      made.push({ ...ref, original, twin });
    }
  }

  recompile(made.map((binding) => binding.material));

  return made;
};

/** Show `image` on the texture: a first swap, or a new image over an earlier one. */
export const applyImage = (
  found: Found,
  kind: TextureKind,
  image: SwapImage,
  existing: Applied | null,
): Applied => {
  if (kind === "image") {
    const original = existing?.mode === "in-place" ? existing.original : found.source.data;

    found.source.data = image;
    bump(found.textures);

    return {
      mode: "in-place",
      image,
      showingOriginal: false,
      original,
      textures: new Set(found.textures),
    };
  }

  if (existing?.mode === "rebind") {
    existing.source.data = image;
    bump(existing.twins.values());

    const applied = { ...existing, image, showingOriginal: false };

    if (existing.showingOriginal) {
      showOriginal(applied, false);
    }

    return applied;
  }

  // The texture's own source class: `Source` before r186, `TextureSource` from it.
  const SourceClass = found.source.constructor as new (data: unknown) => TextureSource;
  const source = new SourceClass(image);
  const twins = new Map([...found.textures].map((texture) => [texture, twinOf(texture, source)]));

  return {
    mode: "rebind",
    image,
    showingOriginal: false,
    source,
    twins,
    bindings: bindRefs(found.refs, twins),
  };
};

/**
 * A rebind swap reaches slots found after it: a mesh mounted later with the original texture.
 * Call after re-finding the scene's textures. In-place swaps need nothing: they changed the data.
 */
export const bindNewRefs = (found: Found, applied: Applied) => {
  if (applied.mode !== "rebind" || applied.showingOriginal) {
    return;
  }

  for (const texture of found.textures) {
    if (!applied.twins.has(texture)) {
      applied.twins.set(texture, twinOf(texture, applied.source));
    }
  }

  applied.bindings.push(...bindRefs(found.refs, applied.twins));
};

/** Flip between the original and the swap (A/B), keeping both. */
export const showOriginal = (applied: Applied, original: boolean) => {
  applied.showingOriginal = original;

  if (applied.mode === "in-place") {
    const first = [...applied.textures][0];

    if (first) {
      first.source.data = original ? applied.original : applied.image;
    }

    bump(applied.textures);

    return;
  }

  for (const binding of applied.bindings) {
    const from = original ? binding.twin : binding.original;

    if (binding.owner[binding.key] === from) {
      binding.owner[binding.key] = original ? binding.original : binding.twin;
    }
  }

  recompile(applied.bindings.map((binding) => binding.material));
};

/** Undo the swap: the original data or bindings back, twins freed. */
export const revertImage = (applied: Applied) => {
  showOriginal(applied, true);

  if (applied.mode === "rebind") {
    for (const twin of applied.twins.values()) {
      twin.dispose();
    }
  }

  if (typeof ImageBitmap !== "undefined" && applied.image instanceof ImageBitmap) {
    applied.image.close();
  }
};

/** The textures drawing now: twins while a rebind swap shows, the originals otherwise. */
export const boundTextures = (found: Found, applied: Applied | null): Texture[] =>
  applied?.mode === "rebind" && !applied.showingOriginal
    ? [...applied.twins.values()]
    : [...found.textures];
