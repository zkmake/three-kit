import {
  ArrayCamera,
  CameraHelper,
  CubeCamera,
  Group,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  WebGLCubeRenderTarget,
} from "three";
import type { Camera, Object3D } from "three";
import { describe, expect, test, vi } from "vitest";

import { findCameras, kindOf, pathOf } from "./discover.ts";
import { CameraLab } from "./lab.ts";

/** Enough of a renderer: `render(scene, camera)` on its prototype, the way three's is. */
class FakeRenderer {
  frames = 0;
  render(_scene: Object3D, _camera: Camera) {
    this.frames += 1;
  }
}

const helpersIn = (scene: Scene) => scene.children.filter((child) => child instanceof CameraHelper);

describe("findCameras", () => {
  test("cameras in scene order; a CubeCamera is one; kinds told apart", () => {
    const scene = new Scene();
    const rig = new Group();
    const main = new PerspectiveCamera();
    const top = new OrthographicCamera();
    const cube = new CubeCamera(0.1, 10, new WebGLCubeRenderTarget(8));
    const array = new ArrayCamera([new PerspectiveCamera()]);

    rig.name = "rig";
    rig.add(main);
    scene.add(rig, top, cube, array);

    expect(findCameras(scene)).toEqual([main, top, cube, array]);
    expect([main, top, cube, array].map(kindOf)).toEqual([
      "perspective",
      "orthographic",
      "cube",
      "array",
    ]);
    expect(pathOf(main)).toEqual(["Scene", "rig"]);
  });
});

describe("CameraLab", () => {
  test("names: registered, camera name, kind; repeats numbered", () => {
    const named = new PerspectiveCamera();
    const registered = new PerspectiveCamera();

    named.name = "dolly";

    const scene = new Scene().add(
      named,
      registered,
      new PerspectiveCamera(),
      new PerspectiveCamera(),
      new OrthographicCamera(),
    );
    const lab = new CameraLab({ scene, cameras: [{ name: "security", camera: registered }] });

    expect(lab.entries().map((entry) => entry.id)).toEqual([
      "dolly",
      "security",
      "perspective camera",
      "perspective camera 2",
      "orthographic camera",
    ]);
  });

  test("the renderer's camera shows up on its first frame, outside the scene, live", async () => {
    const scene = new Scene().add(new OrthographicCamera());
    const renderer = new FakeRenderer();
    const lab = new CameraLab({ scene, renderer });
    const listener = vi.fn();
    const view = new PerspectiveCamera(50, 2);

    lab.subscribe(listener);
    expect(lab.entries().map((entry) => entry.id)).toEqual(["orthographic camera"]);

    renderer.render(scene, view);
    renderer.render(scene, view);
    await Promise.resolve();

    expect(renderer.frames).toBe(2);
    expect(listener).toHaveBeenCalledOnce();
    expect(lab.entry("perspective camera")).toMatchObject({
      inScene: false,
      live: true,
      fps: 2,
      kind: "perspective",
    });
    expect(lab.entry("orthographic camera")).toMatchObject({ inScene: true, live: false, fps: 0 });
  });

  test("details: world position, rotation in degrees, projection", () => {
    const rig = new Group();
    const camera = new PerspectiveCamera(40, 1.5, 0.5, 200);

    rig.position.set(10, 0, 0);
    camera.position.set(0, 2, 5);
    camera.rotation.set(0, Math.PI / 2, 0);
    rig.add(camera);

    const lab = new CameraLab({ scene: new Scene().add(rig) });
    const details = lab.details("perspective camera")!;

    expect(details.position.map((value) => Math.round(value * 1e6) / 1e6)).toEqual([10, 2, 5]);
    expect(details.rotation[1]).toBeCloseTo(90);
    expect(details.projection).toMatchObject({ fov: 40, aspect: 1.5, near: 0.5, far: 200 });
  });

  test("frustum helpers: added to the scene, hidden while looked through, removed", () => {
    const top = new OrthographicCamera();
    const scene = new Scene().add(top);
    const renderer = new FakeRenderer();
    const invalidate = vi.fn();
    const lab = new CameraLab({ scene, renderer, invalidate });
    const view = new PerspectiveCamera();

    lab.setHelper("orthographic camera", true);
    expect(helpersIn(scene)).toHaveLength(1);
    expect(lab.entry("orthographic camera")!.helper).toBe(true);
    expect(invalidate).toHaveBeenCalledOnce();

    renderer.render(scene, top);
    expect(helpersIn(scene)[0]!.visible).toBe(false);
    renderer.render(scene, view);
    expect(helpersIn(scene)[0]!.visible).toBe(true);

    lab.setHelper("orthographic camera", false);
    expect(helpersIn(scene)).toHaveLength(0);
  });

  test("a cube camera has no helper; a camera that left the scene goes", () => {
    const cube = new CubeCamera(0.1, 10, new WebGLCubeRenderTarget(8));
    const camera = new PerspectiveCamera();
    const scene = new Scene().add(cube, camera);
    const lab = new CameraLab({ scene });

    expect(lab.entry("cube camera")!.canHelp).toBe(false);
    expect(() => lab.setHelper("cube camera", true)).toThrow(/no frustum/);

    lab.setHelper("perspective camera", true);
    scene.remove(camera);
    lab.refresh();
    expect(lab.entry("perspective camera")).toBeNull();
    expect(helpersIn(scene)).toHaveLength(0);
  });

  test("a CubeCamera's face cameras aren't listed when it renders them", () => {
    const cube = new CubeCamera(0.1, 10, new WebGLCubeRenderTarget(8));
    const scene = new Scene().add(cube);
    const renderer = new FakeRenderer();
    const lab = new CameraLab({ scene, renderer });

    for (const face of cube.children) {
      renderer.render(scene, face as Camera);
    }

    expect(lab.entries().map((entry) => entry.id)).toEqual(["cube camera"]);
  });

  test("dispose restores render, removes helpers, and leaves a later wrapper alone", () => {
    const scene = new Scene().add(new PerspectiveCamera());
    const renderer = new FakeRenderer();
    const lab = new CameraLab({ scene, renderer });

    expect(Object.hasOwn(renderer, "render")).toBe(true);
    lab.setHelper("perspective camera", true);
    lab.dispose();
    expect(Object.hasOwn(renderer, "render")).toBe(false);
    expect(helpersIn(scene)).toHaveLength(0);

    const other = new FakeRenderer();
    const second = new CameraLab({ scene, renderer: other });
    const theirs = vi.fn();

    other.render = theirs;
    second.dispose();
    expect(other.render).toBe(theirs);
  });
});
