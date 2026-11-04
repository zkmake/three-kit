import {
  BoxGeometry,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  SpotLight,
} from "three";
import { describe, expect, test } from "vitest";

import { findShadowIssues } from "./shadow-issues.ts";

const material = new MeshBasicMaterial();

const sun = (name = "sun") => {
  const light = new DirectionalLight();

  light.name = name;
  light.position.set(0, 20, 0);
  light.castShadow = true;
  light.shadow.normalBias = 0.02;
  light.shadow.camera.left = -6;
  light.shadow.camera.right = 6;
  light.shadow.camera.top = 6;
  light.shadow.camera.bottom = -6;
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 40;
  light.shadow.camera.updateProjectionMatrix();

  return light;
};

const prop = (size = 10, castShadow = true, receiveShadow = true) => {
  const mesh = new Mesh(new BoxGeometry(size, 1, size), material);

  mesh.name = "prop";
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;

  return mesh;
};

const problems = (scene: Scene, renderer?: Parameters<typeof findShadowIssues>[1]) =>
  findShadowIssues(scene, renderer).map((row) => row.problem);

const on = { renderer: { shadowMap: { enabled: true, type: 1 } } };

describe("findShadowIssues", () => {
  test("a sound setup, and a scene with no lights or shadows, have nothing to report", () => {
    const sound = new Scene();

    sound.add(sun(), prop());

    expect(findShadowIssues(sound, on)).toEqual([]);
    expect(findShadowIssues(new Scene().add(prop(1, false, false)))).toEqual([]);
    // A part alone, in a test, is no setup at all.
    expect(findShadowIssues(new Scene().add(prop()))).toEqual([]);
  });

  test("the renderer: shadows off, and the removed map type", () => {
    const scene = new Scene();

    scene.add(sun(), prop());

    expect(problems(scene, { renderer: { shadowMap: { enabled: false } } })).toEqual([
      "shadows-off",
    ]);

    const [row] = findShadowIssues(scene, { renderer: { shadowMap: { enabled: true, type: 2 } } });

    expect(row).toMatchObject({ subject: "renderer", problem: "removed-map-type" });
    expect(row!.detail).toMatch(/PCFShadowMap/);
    // Without a renderer there's no knowing, so no complaint.
    expect(problems(scene)).toEqual([]);
  });

  test("nothing to cast, to receive, or to cast from", () => {
    const noCasters = new Scene();

    noCasters.add(sun(), prop(10, false, true));
    expect(problems(noCasters, on)).toEqual(["no-casters"]);

    const noReceivers = new Scene();

    noReceivers.add(sun(), prop(10, true, false));
    expect(problems(noReceivers, on)).toEqual(["no-receivers"]);

    const noLight = new Scene();
    const lamp = new DirectionalLight();

    noLight.add(lamp, prop());
    expect(problems(noLight, on)).toEqual(["no-shadow-light"]);
  });

  test("hidden lights and meshes don't count", () => {
    const scene = new Scene();
    const light = sun();

    light.visible = false;
    scene.add(light, prop());

    expect(findShadowIssues(scene, on)).toEqual([]);
  });

  test("casters outside the shadow camera", () => {
    const scene = new Scene();
    const far = prop(1);

    far.name = "far-tower";
    far.position.x = 40;
    scene.add(sun(), prop(), far);

    const [row] = findShadowIssues(scene, on);

    expect(row).toMatchObject({ subject: "sun", problem: "casters-outside" });
    expect(row!.detail).toMatch(/1 of 2 casters/);
    expect(row!.detail).toMatch(/BoxGeometry|far-tower/);
    expect(row!.object).toBeInstanceOf(DirectionalLight);
  });

  describe("with the player's camera", () => {
    /** Looking along +x from the origin: what the sun covers ahead of it, and what lies past. */
    const walk = (x: number) => {
      const mesh = prop(1);

      mesh.name = `at-${x}`;
      mesh.position.x = x;

      return mesh;
    };
    const player = () => {
      const view = new PerspectiveCamera(60, 1, 0.1, 500);

      view.lookAt(1, 0, 0);

      return view;
    };

    test("a caster out of view doesn't count", () => {
      const scene = new Scene();

      scene.add(sun(), walk(3), walk(-40));

      expect(problems(scene, { ...on, camera: player() })).not.toContain("casters-outside");
    });

    test("nor one past what the shadow camera reaches: fitted around the player on purpose", () => {
      const scene = new Scene();

      scene.add(sun(), walk(3), walk(100));

      expect(problems(scene, on)).toEqual(["casters-outside"]);
      expect(problems(scene, { ...on, camera: player() })).not.toContain("casters-outside");
    });

    test("one nearer than what it covers is a hole", () => {
      const scene = new Scene();
      const light = sun();

      // The sun's window starts 20 out, so it covers what's at 30 and misses what's at 5.
      light.position.x = 30;
      light.target.position.x = 30;
      scene.add(light, light.target, walk(5), walk(30));

      const [row] = findShadowIssues(scene, { ...on, camera: player() });

      expect(row!.problem).toBe("casters-outside");
      expect(row!.detail).toMatch(/1 of 2 casters are in view/);
      expect(row!.detail).toMatch(/nearer than ones it covers/);
    });
  });

  test("a spot light's cone too", () => {
    const scene = new Scene();
    const spot = new SpotLight();

    spot.castShadow = true;
    spot.shadow.normalBias = 0.02;
    spot.position.set(0, 10, 0);

    const far = prop(1);

    far.position.x = 200;
    scene.add(spot, far);

    expect(problems(scene, on)).toEqual(["casters-outside"]);
  });

  test("a shadow camera far bigger than what casts", () => {
    const scene = new Scene();
    const light = sun();

    light.shadow.camera.left = -100;
    light.shadow.camera.right = 100;
    light.shadow.camera.top = 100;
    light.shadow.camera.bottom = -100;
    light.shadow.camera.updateProjectionMatrix();
    light.shadow.mapSize.set(1024, 1024);
    scene.add(light, prop(2));

    const [row] = findShadowIssues(scene, on);

    expect(row!.problem).toBe("camera-too-big");
    expect(row!.detail).toMatch(/casters fill 0%/);
    expect(row!.detail).toMatch(/texel is 0\.20 wide/);
    expect(findShadowIssues(scene, { ...on, emptyShare: 1 })).toEqual([]);
  });

  test("bias: none at all, and too much for the texels", () => {
    const none = new Scene();
    const flat = sun();

    flat.shadow.normalBias = 0;
    none.add(flat, prop());
    expect(problems(none, on)).toEqual(["no-bias"]);
    // Variance shadows don't compare depths, so they don't need it.
    expect(problems(none, { renderer: { shadowMap: { enabled: true, type: 3 } } })).toEqual([]);

    const lifted = new Scene();
    const light = sun();

    light.shadow.normalBias = 2;
    lifted.add(light, prop());

    const [row] = findShadowIssues(lifted, on);

    expect(row!.problem).toBe("bias-too-big");
    expect(row!.detail).toMatch(/shadow texels/);
  });

  test("point lights get the bias check, and no camera check", () => {
    const scene = new Scene();
    const lamp = new PointLight();

    lamp.castShadow = true;
    lamp.position.set(100, 100, 100);
    scene.add(lamp, prop());

    expect(problems(scene, on)).toEqual(["no-bias"]);
  });

  test("rows are JSON-safe, and what's skipped stays out", () => {
    const scene = new Scene();
    const light = sun();

    light.shadow.normalBias = 0;
    scene.add(light, prop());

    const [row] = findShadowIssues(scene, on);

    expect(Object.keys(row!)).toEqual(["subject", "problem", "detail"]);
    expect(findShadowIssues(scene, { ...on, skip: (object) => object.name === "sun" })).toEqual([]);
  });
});
