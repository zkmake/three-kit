import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Vector3,
} from "three";
import { describe, expect, test } from "vitest";

import { formatStats, frameStats, setWireframe } from "./frame.ts";
import { applyView, orbitViews } from "./views.ts";

const forward = (camera: PerspectiveCamera | OrthographicCamera) =>
  camera.getWorldDirection(new Vector3());

describe("applyView", () => {
  test("places, aims and sets the lens, and moves the controls' target", () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    const controls = { target: new Vector3(), updates: 0, update: () => (controls.updates += 1) };

    applyView(
      camera,
      { position: [0, 0, 10], target: [0, 0, 0], fov: 25, near: 0.5, far: 50 },
      controls,
    );

    expect(camera.position.toArray()).toEqual([0, 0, 10]);
    expect(forward(camera).z).toBeCloseTo(-1);
    expect([camera.fov, camera.near, camera.far]).toEqual([25, 0.5, 50]);
    expect(camera.projectionMatrix.elements[5]).toBeCloseTo(1 / Math.tan((25 * Math.PI) / 360));
    expect(controls.target.toArray()).toEqual([0, 0, 0]);
    expect(controls.updates).toBe(1);
  });

  test("keeps an orthographic camera's frustum and sets its zoom", () => {
    const camera = new OrthographicCamera(-1, 1, 1, -1);

    applyView(camera, { position: [5, 0, 0], target: [0, 0, 0], fov: 10, zoom: 2 });

    expect(camera.zoom).toBe(2);
    expect(forward(camera).x).toBeCloseTo(-1);
  });
});

describe("orbitViews", () => {
  test("play copies the game camera; the rest stand near away from the centre", () => {
    const views = orbitViews([0, 1, 0], 4, { play: { offset: [0, 3, 8], fov: 28 } });

    expect(Object.keys(views)).toEqual(["play", "close", "front", "side", "back", "top"]);
    expect(views.play).toEqual({ position: [0, 4, 8], target: [0, 1, 0], fov: 28 });

    for (const name of ["close", "front", "side", "back", "top"]) {
      const { position, target, fov } = views[name]!;

      expect(
        Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2]),
      ).toBeCloseTo(4);
      expect(fov).toBe(40);
    }

    // close looks along the play bearing.
    const [x, y, z] = views.close!.position;

    expect([x / 4, (y - 1) / 4, z / 4].map((n) => n.toFixed(4))).toEqual(
      [0, 3 / Math.hypot(3, 8), 8 / Math.hypot(3, 8)].map((n) => n.toFixed(4)),
    );
  });

  test("front turns front, side and back together", () => {
    const plain = orbitViews([0, 0, 0], 4);
    const kart = orbitViews([0, 0, 0], 4, { front: [0, 0.25, -1] });
    const unit = (view: { position: readonly number[] }) =>
      view.position.map((n) => (n / 4).toFixed(4));
    const along = (x: number, y: number, z: number) =>
      [x, y, z].map((n) => (n / Math.hypot(x, y, z)).toFixed(4));

    expect(unit(plain.front!)).toEqual(along(1, 0.25, 0));
    expect(unit(plain.side!)).toEqual(along(0, 0.25, 1));
    expect(unit(plain.back!)).toEqual(along(-1, 0.25, 0));
    expect(unit(kart.front!)).toEqual(along(0, 0.25, -1));
    expect(unit(kart.side!)).toEqual(along(1, 0.25, 0));
    expect(unit(kart.back!)).toEqual(along(0, 0.25, 1));
  });

  test("top doesn't look straight down, so lookAt keeps its heading", () => {
    const camera = new PerspectiveCamera();

    applyView(camera, orbitViews([0, 0, 0], 5).top!);

    expect(Number.isFinite(camera.quaternion.x)).toBe(true);
    expect(forward(camera).y).toBeCloseTo(-1);
  });
});

describe("frame helpers", () => {
  test("format the last render's draws and triangles", () => {
    const stats = frameStats({ info: { render: { calls: 12, triangles: 34567 } } });

    expect(formatStats(stats)).toBe("12 calls · 34,567 tris");
  });

  test("setWireframe draws wireframe and puts each material back", () => {
    const plain = new MeshBasicMaterial();
    const already = new MeshStandardMaterial({ wireframe: true });
    const group = new Mesh(new BoxGeometry(), plain);

    group.add(new Mesh(new BoxGeometry(), [already, plain]));

    setWireframe(group, true);
    setWireframe(group, true);
    expect([plain.wireframe, already.wireframe]).toEqual([true, true]);

    setWireframe(group, false);
    expect([plain.wireframe, already.wireframe]).toEqual([false, true]);
    expect(plain.userData).toEqual({});
  });
});
