import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
} from "three";
import { describe, expect, test } from "vitest";

import { transparentOverdraw } from "./transparent-overdraw.ts";

const glass = new MeshBasicMaterial({ transparent: true, name: "glass" });

/** Looking down -z at a 2 × 2 view: a unit plane at the origin covers a quarter of it. */
const camera = () => {
  const view = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

  view.position.z = 10;

  return view;
};

describe("transparentOverdraw", () => {
  test("opaque meshes and a scene with none count for nothing", () => {
    const scene = new Scene();

    scene.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));

    expect(transparentOverdraw(scene)).toEqual({ draws: 0, triangles: 0, screens: null, rows: [] });
  });

  test("transparent and additive count; hidden ones and invisible materials don't", () => {
    const scene = new Scene();
    const hidden = new Mesh(new BoxGeometry(), glass);
    const off = new Mesh(
      new BoxGeometry(),
      new MeshBasicMaterial({ transparent: true, visible: false }),
    );

    hidden.visible = false;
    scene.add(
      new Mesh(new BoxGeometry(), glass),
      new Mesh(
        new PlaneGeometry(),
        new MeshBasicMaterial({ blending: AdditiveBlending, name: "glow" }),
      ),
      hidden,
      off,
    );

    const result = transparentOverdraw(scene);

    expect(result.draws).toBe(2);
    expect(result.triangles).toBe(14);
    expect(result.screens).toBeNull();
    expect(result.rows.map((row) => row.mesh)).toEqual([
      "BoxGeometry [glass]",
      "PlaneGeometry [glow]",
    ]);
  });

  test("instances count their triangles, each once", () => {
    const scene = new Scene();
    const many = new InstancedMesh(new PlaneGeometry(), glass, 5);

    for (let i = 0; i < 5; i += 1) {
      many.setMatrixAt(i, new Matrix4().makeTranslation(i, 0, 0));
    }

    scene.add(many);

    const result = transparentOverdraw(scene);

    expect(result.rows[0]).toMatchObject({ triangles: 10, instances: 5, draws: 1 });
  });

  test("a camera adds how many screens they cover, most first", () => {
    const scene = new Scene();
    const small = new Mesh(new PlaneGeometry(1, 1), glass);
    const full = new Mesh(new PlaneGeometry(2, 2), glass);
    const away = new Mesh(new PlaneGeometry(1, 1), glass);

    small.name = "small";
    full.name = "full";
    away.name = "away";
    away.position.x = 50;
    scene.add(small, full, away);

    const result = transparentOverdraw(scene, { camera: camera() });

    expect(result.rows.map((row) => [row.mesh, row.screens])).toEqual([
      ["full [glass]", 1],
      ["small [glass]", 0.25],
      ["away [glass]", 0],
    ]);
    expect(result.screens).toBe(1.25);
  });

  test("layers add up: ten sheets deep is ten screens", () => {
    const scene = new Scene();
    const sheets = new InstancedMesh(new PlaneGeometry(2, 2), glass, 10);

    for (let i = 0; i < 10; i += 1) {
      sheets.setMatrixAt(i, new Matrix4().makeTranslation(0, 0, i * 0.1));
    }

    scene.add(sheets);

    expect(transparentOverdraw(scene, { camera: camera() }).screens).toBe(10);
  });

  test("a box the camera stands in counts as the whole view; one behind it as nothing", () => {
    const scene = new Scene();
    const around = new Mesh(new BoxGeometry(50, 50, 50), glass);
    const behind = new Mesh(new PlaneGeometry(1, 1), glass);
    const view = new PerspectiveCamera(60, 1, 0.1, 100);

    behind.position.z = 40;
    view.position.z = 10;
    scene.add(around, behind);

    expect(transparentOverdraw(scene, { camera: view }).rows.map((row) => row.screens)).toEqual([
      1, 0,
    ]);
  });

  test("point clouds count as draws, by their box", () => {
    const scene = new Scene();
    const geometry = new BufferGeometry();

    geometry.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 1, 1, 0], 3));

    const sparks = new Points(geometry, new PointsMaterial({ transparent: true, name: "spark" }));

    sparks.name = "sparks";
    scene.add(sparks);

    const result = transparentOverdraw(scene, { camera: camera() });

    expect(result.rows[0]).toMatchObject({ mesh: "sparks [spark]", triangles: 0, screens: 1 });
  });

  test("rows are JSON-safe", () => {
    const scene = new Scene();

    scene.add(new Mesh(new PlaneGeometry(), glass));

    expect(() => JSON.stringify(transparentOverdraw(scene))).not.toThrow();
  });
});
