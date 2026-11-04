/**
 * Colour management that draws wrong, read off the scene: a colour texture read as data (washed
 * out, or dark in the wrong places), a data texture read as colour (normals and roughness curved
 * by the sRGB transfer), output that isn't sRGB, and exposure that blacks the frame out.
 *
 * Textures are found on materials by slot; a node material's graph can't be read this way, so what
 * only its nodes use goes unchecked.
 */
import type { Material, Object3D, Scene, Texture } from "three";

import { type AnyObject3D, asObject3D, isDrawable, materialsOf, type Skip, walk } from "./scene.ts";
import type { SetupRenderer } from "./shadow-issues.ts";

export type ColorProblem =
  | "color-map-as-data"
  | "data-map-as-color"
  | "background-as-data"
  | "output-not-srgb"
  | "no-exposure"
  | "environment-without-tone-mapping";

export type ColorOptions = {
  /** Lets the check read output colour space and tone mapping. */
  renderer?: SetupRenderer | undefined;
  skip?: Skip | undefined;
};

export type ColorIssue = {
  /** The texture and its slot, or `renderer` or `scene`. */
  subject: string;
  problem: ColorProblem;
  /** What's wrong, and what to do. */
  detail: string;
  /** Materials using it, when it's about a texture. */
  materials: string[];
  /** Not enumerable: kept out of JSON and `console.table`. */
  readonly texture: Texture | null;
};

const NO_COLOR_SPACE = "";
const SRGB = "srgb";
/** Slots holding colour: stored in sRGB, so they need telling so. */
const COLOR_SLOTS = ["map", "emissiveMap", "specularColorMap", "sheenColorMap"] as const;
/** Slots holding numbers: the sRGB curve would bend them. */
const DATA_SLOTS = [
  "normalMap",
  "clearcoatNormalMap",
  "bumpMap",
  "displacementMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "alphaMap",
  "clearcoatMap",
  "clearcoatRoughnessMap",
  "transmissionMap",
  "thicknessMap",
  "specularIntensityMap",
  "sheenRoughnessMap",
  "iridescenceMap",
  "iridescenceThicknessMap",
  "anisotropyMap",
] as const;

type Slots = Partial<Record<(typeof COLOR_SLOTS | typeof DATA_SLOTS)[number], Texture | null>>;

const issue = (
  subject: string,
  problem: ColorProblem,
  detail: string,
  materials: string[] = [],
  texture: Texture | null = null,
): ColorIssue =>
  Object.defineProperty({ subject, problem, detail, materials }, "texture", {
    value: texture,
    enumerable: false,
  }) as ColorIssue;

/** A texture's name, else the file or canvas it came from. */
export const textureName = (texture: Texture) => {
  if (texture.name) {
    return texture.name;
  }

  const image = texture.image as { src?: unknown; tagName?: unknown } | null | undefined;

  if (typeof image?.src === "string" && !image.src.startsWith("data:")) {
    return image.src.split("/").pop()?.split("?")[0] || "Texture";
  }

  return (texture as { isCanvasTexture?: boolean }).isCanvasTexture === true
    ? "CanvasTexture"
    : "Texture";
};

const materialLabel = (material: Material) => material.name || material.type;

/** Colour management that draws wrong, grouped by texture and slot. `[]` is a pass. */
export const findColorIssues = (scene: AnyObject3D, options: ColorOptions = {}): ColorIssue[] => {
  const root = asObject3D(scene);
  const { renderer, skip } = options;
  const rows: ColorIssue[] = [];
  const found = new Map<string, ColorIssue>();
  const seen = new Set<Material>();

  const note = (
    texture: Texture,
    slot: string,
    material: Material,
    problem: ColorProblem,
    detail: string,
  ) => {
    const key = `${texture.uuid}:${slot}`;
    const label = materialLabel(material);
    const known = found.get(key);

    if (!known) {
      found.set(key, issue(`${textureName(texture)} (${slot})`, problem, detail, [label], texture));
    } else if (!known.materials.includes(label)) {
      known.materials.push(label);
    }
  };

  walk(root, { skip }, (object: Object3D) => {
    if (!isDrawable(object)) {
      return;
    }

    for (const material of materialsOf(object as never)) {
      if (seen.has(material)) {
        continue;
      }

      seen.add(material);

      const slots = material as unknown as Slots;

      for (const slot of COLOR_SLOTS) {
        const texture = slots[slot];

        if (texture && texture.colorSpace === NO_COLOR_SPACE) {
          note(
            texture,
            slot,
            material,
            "color-map-as-data",
            "a colour texture with no colour space is read as linear, so it draws washed out. Set texture.colorSpace = SRGBColorSpace.",
          );
        }
      }

      for (const slot of DATA_SLOTS) {
        const texture = slots[slot];

        if (texture && texture.colorSpace === SRGB) {
          note(
            texture,
            slot,
            material,
            "data-map-as-color",
            "a data texture marked sRGB has its numbers bent by the colour curve. Leave its colorSpace at NoColorSpace.",
          );
        }
      }
    }
  });

  rows.push(...found.values());

  const { background, environment } = root as Scene;

  if (
    (background as Texture | null | undefined)?.isTexture === true &&
    (background as Texture).colorSpace === NO_COLOR_SPACE
  ) {
    rows.push(
      issue(
        `${textureName(background as Texture)} (scene.background)`,
        "background-as-data",
        "a background image with no colour space is read as linear, so it draws washed out. Set its colorSpace to SRGBColorSpace.",
        [],
        background as Texture,
      ),
    );
  }

  if (renderer?.outputColorSpace !== undefined && renderer.outputColorSpace !== SRGB) {
    if (renderer.outputColorSpace !== "display-p3") {
      rows.push(
        issue(
          "renderer",
          "output-not-srgb",
          `outputColorSpace is "${renderer.outputColorSpace}", so every colour draws dark unless a later pass converts it. Leave it at SRGBColorSpace.`,
        ),
      );
    }
  }

  if (renderer?.toneMapping !== undefined && renderer.toneMapping !== 0) {
    if (renderer.toneMappingExposure !== undefined && !(renderer.toneMappingExposure > 0)) {
      rows.push(
        issue(
          "renderer",
          "no-exposure",
          `toneMappingExposure is ${renderer.toneMappingExposure}, which draws everything black.`,
        ),
      );
    }
  } else if (renderer?.toneMapping === 0 && environment) {
    rows.push(
      issue(
        "scene",
        "environment-without-tone-mapping",
        "an environment map's highlights run past 1 and clip with no tone mapping. Set renderer.toneMapping, or make sure a later pass maps tones.",
      ),
    );
  }

  return rows;
};
