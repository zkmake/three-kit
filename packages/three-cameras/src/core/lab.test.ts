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
import { afterEach, describe, expect, test, vi } from "vitest";

import { findCameras, kindOf, pathOf } from "./discover.ts";
import { CameraLab } from "./lab.ts";
import { blendPoses, capturePose, poseToCode } from "./pose.ts";

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

describe("controls", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("set: local position, rotation in degrees, lens; the projection updates", () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    const invalidate = vi.fn();
    const lab = new CameraLab({ scene: new Scene().add(camera), invalidate });
    const before = camera.projectionMatrix.clone();

    lab.set("perspective camera", {
      position: [1, 2, 3],
      rotation: [0, 90, 0],
      fov: 30,
      near: 0.5,
    });

    expect(camera.position.toArray()).toEqual([1, 2, 3]);
    expect(camera.rotation.y).toBeCloseTo(Math.PI / 2);
    expect([camera.fov, camera.near, camera.far]).toEqual([30, 0.5, 100]);
    expect(camera.projectionMatrix.equals(before)).toBe(false);
    expect(lab.details("perspective camera")!.local.rotation[1]).toBeCloseTo(90);
    expect(invalidate).toHaveBeenCalled();
  });

  test("look through: the app's main camera is swapped out, fitted to its aspect, and back", () => {
    const security = new PerspectiveCamera(60, 4 / 3);

    security.name = "security";

    const scene = new Scene().add(security);
    const seen: Camera[] = [];
    const aspects: number[] = [];
    const renderer = {
      render(_scene: Object3D, camera: Camera) {
        seen.push(camera);
        aspects.push((camera as PerspectiveCamera).aspect);
      },
    };
    const lab = new CameraLab({ scene, renderer });
    const view = new PerspectiveCamera(45, 2);

    expect(() => lab.lookThrough("security")).toThrow(/no camera is drawing/);

    renderer.render(scene, view);
    lab.lookThrough("security");
    renderer.render(scene, view);

    expect(seen.at(-1)).toBe(security);
    expect(aspects.at(-1)).toBe(2);
    expect(security.aspect).toBeCloseTo(4 / 3);
    expect(lab.entry("security")).toMatchObject({ viewing: true, live: true });
    expect(lab.entry("perspective camera")).toMatchObject({ standingIn: true });

    lab.lookThrough(null);
    renderer.render(scene, view);
    expect(seen.at(-1)).toBe(view);
    expect(lab.entry("security")!.viewing).toBe(false);
  });

  test("look through stands in for the view drawing the most of the screen, not an inset", () => {
    const security = new PerspectiveCamera();
    const main = new PerspectiveCamera();
    const inset = new PerspectiveCamera();

    security.name = "security";
    main.name = "main";
    inset.name = "inset";

    const scene = new Scene().add(security, main, inset);
    const seen: Camera[] = [];
    let size = [0, 0];
    const renderer = {
      getCurrentViewport: (target: { set: (...v: number[]) => unknown }) =>
        target.set(0, 0, size[0]!, size[1]!),
      getRenderTarget: () => null,
      render(_scene: Object3D, camera: Camera) {
        seen.push(camera);
      },
    };
    const lab = new CameraLab({ scene, renderer });

    // The inset draws first each frame here, and just as often.
    size = [200, 120];
    renderer.render(scene, inset);
    size = [1600, 900];
    renderer.render(scene, main);

    lab.lookThrough("security");
    size = [200, 120];
    renderer.render(scene, inset);
    size = [1600, 900];
    renderer.render(scene, main);

    expect(seen.slice(-2)).toEqual([inset, security]);
  });

  test("saved views: save, list, a move eased over frames, delete, kept in the store", () => {
    vi.useFakeTimers();

    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    const scene = new Scene().add(camera);
    const renderer = new FakeRenderer();
    const stored: Record<string, unknown>[] = [];
    const store = {
      load: () => ({}),
      save: (views: Record<string, unknown>) => void stored.push(views),
    };
    const lab = new CameraLab({ scene, renderer, store: store as never });

    camera.position.set(0, 0, 10);

    const home = lab.saveView("perspective camera");

    expect(home.name).toBe("view 1");
    expect(lab.entry("perspective camera")!.views).toBe(1);
    expect(stored).toHaveLength(1);

    camera.position.set(10, 0, 0);
    camera.fov = 20;
    camera.updateProjectionMatrix();
    lab.goToView("perspective camera", home.id, { duration: 1000 });

    vi.advanceTimersByTime(500);
    renderer.render(scene, new PerspectiveCamera());
    expect(camera.position.x).toBeCloseTo(5);
    expect(camera.fov).toBeCloseTo(35);

    vi.advanceTimersByTime(600);
    renderer.render(scene, new PerspectiveCamera());
    expect(camera.position.toArray()).toEqual([0, 0, 10]);
    expect(camera.fov).toBe(50);

    lab.deleteView("perspective camera", home.id);
    expect(lab.views("perspective camera")).toEqual([]);
    expect(stored).toHaveLength(2);
  });

  test("a move with no renderer lands at once", () => {
    const camera = new PerspectiveCamera();
    const lab = new CameraLab({ scene: new Scene().add(camera) });
    const view = lab.saveView("perspective camera", "home");

    camera.position.set(4, 4, 4);
    lab.goToView("perspective camera", view.id);
    expect(camera.position.toArray()).toEqual([0, 0, 0]);
  });
});

describe("poses", () => {
  test("blend: positions straight, rotation by slerp, lenses between", () => {
    const a = new PerspectiveCamera(40, 1, 1, 100);
    const b = new PerspectiveCamera(60, 1, 1, 300);

    b.position.set(10, 0, 0);
    b.rotation.set(0, Math.PI / 2, 0);

    const half = blendPoses(capturePose(a), capturePose(b), 0.5);

    expect(half.position).toEqual([5, 0, 0]);
    expect(half.fov).toBe(50);
    expect(half.far).toBe(200);
    expect(half.quaternion[1]).toBeCloseTo(Math.sin(Math.PI / 8));
  });

  test("to code: three.js that recreates the pose", () => {
    const camera = new PerspectiveCamera(35, 1, 0.1, 50);

    camera.position.set(1.5, 2, -3);
    expect(poseToCode(capturePose(camera), "dolly")).toBe(
      [
        "dolly.position.set(1.5, 2, -3);",
        "dolly.quaternion.set(0, 0, 0, 1);",
        "dolly.fov = 35;",
        "dolly.near = 0.1;",
        "dolly.far = 50;",
        "dolly.updateProjectionMatrix();",
      ].join("\n"),
    );
  });
});
