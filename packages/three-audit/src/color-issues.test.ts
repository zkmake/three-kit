import {
  BoxGeometry,
  CanvasTexture,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  Scene,
  SRGBColorSpace,
  Texture,
} from "three";
import { describe, expect, test } from "vitest";

import { findColorIssues } from "./color-issues.ts";

const named = (name: string, colorSpace: string) => {
  const texture = new Texture();

  texture.name = name;
  texture.colorSpace = colorSpace;

  return texture;
};

const mesh = (material: MeshBasicMaterial | MeshStandardMaterial) =>
  new Mesh(new BoxGeometry(), material);

describe("findColorIssues", () => {
  test("a sound scene, with the right spaces in the right slots", () => {
    const scene = new Scene();

    scene.add(
      mesh(
        new MeshStandardMaterial({
          map: named("albedo", SRGBColorSpace),
          emissiveMap: named("glow", SRGBColorSpace),
          normalMap: named("normal", NoColorSpace),
          roughnessMap: named("rough", NoColorSpace),
        }),
      ),
    );

    expect(
      findColorIssues(scene, {
        renderer: { outputColorSpace: "srgb", toneMapping: 6, toneMappingExposure: 1 },
      }),
    ).toEqual([]);
  });

  test("a colour texture left as data", () => {
    const scene = new Scene();
    const material = new MeshBasicMaterial({ map: named("albedo", NoColorSpace), name: "wood" });

    scene.add(mesh(material));

    const [row] = findColorIssues(scene);

    expect(row).toMatchObject({
      subject: "albedo (map)",
      problem: "color-map-as-data",
      materials: ["wood"],
    });
    expect(row!.detail).toMatch(/SRGBColorSpace/);
    expect(row!.texture).toBe(material.map);
  });

  test("a canvas texture is named for what it is", () => {
    const scene = new Scene();
    const texture = new CanvasTexture({ width: 4, height: 4 } as never);

    scene.add(mesh(new MeshBasicMaterial({ map: texture })));

    expect(findColorIssues(scene)[0]!.subject).toBe("CanvasTexture (map)");
  });

  test("a colour texture explicitly linear is someone's decision", () => {
    const scene = new Scene();

    scene.add(mesh(new MeshBasicMaterial({ map: named("ramp", LinearSRGBColorSpace) })));

    expect(findColorIssues(scene)).toEqual([]);
  });

  test("a data texture marked sRGB", () => {
    const scene = new Scene();

    scene.add(mesh(new MeshStandardMaterial({ normalMap: named("normal", SRGBColorSpace) })));

    expect(findColorIssues(scene)[0]).toMatchObject({
      subject: "normal (normalMap)",
      problem: "data-map-as-color",
    });
  });

  test("one texture on several materials is one row", () => {
    const scene = new Scene();
    const texture = named("shared", NoColorSpace);

    scene.add(
      mesh(new MeshBasicMaterial({ map: texture, name: "a" })),
      mesh(new MeshBasicMaterial({ map: texture, name: "b" })),
    );

    const rows = findColorIssues(scene);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.materials).toEqual(["a", "b"]);
  });

  test("hidden meshes count, as their textures are still theirs; skip leaves them out", () => {
    const scene = new Scene();
    const hidden = mesh(new MeshBasicMaterial({ map: named("albedo", NoColorSpace) }));

    hidden.visible = false;
    hidden.name = "hidden";
    scene.add(hidden);

    expect(findColorIssues(scene)).toHaveLength(1);
    expect(findColorIssues(scene, { skip: (object) => object.name === "hidden" })).toEqual([]);
  });

  test("the background", () => {
    const scene = new Scene();

    scene.background = named("sky", NoColorSpace);

    expect(findColorIssues(scene)[0]).toMatchObject({
      subject: "sky (scene.background)",
      problem: "background-as-data",
    });
  });

  test("the renderer: linear output, no exposure, an environment untoned", () => {
    const scene = new Scene();

    expect(
      findColorIssues(scene, { renderer: { outputColorSpace: "srgb-linear" } })[0],
    ).toMatchObject({ subject: "renderer", problem: "output-not-srgb" });
    expect(findColorIssues(scene, { renderer: { outputColorSpace: "display-p3" } })).toEqual([]);
    expect(
      findColorIssues(scene, { renderer: { toneMapping: 6, toneMappingExposure: 0 } })[0]!.problem,
    ).toBe("no-exposure");
    expect(findColorIssues(scene, { renderer: { toneMapping: 0 } })).toEqual([]);

    scene.environment = new Texture();

    expect(findColorIssues(scene, { renderer: { toneMapping: 0 } })[0]!.problem).toBe(
      "environment-without-tone-mapping",
    );
    expect(
      findColorIssues(scene, { renderer: { toneMapping: 6, toneMappingExposure: 1 } }),
    ).toEqual([]);
  });

  test("rows are JSON-safe", () => {
    const scene = new Scene();

    scene.add(mesh(new MeshBasicMaterial({ map: named("albedo", NoColorSpace) })));

    expect(Object.keys(findColorIssues(scene)[0]!)).toEqual([
      "subject",
      "problem",
      "detail",
      "materials",
    ]);
  });
});
