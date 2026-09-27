import { describe, expect, test } from "vitest";

import { PerformanceMonitor } from "./performance-monitor.ts";
import { computeSceneCost } from "./scene-cost.ts";
import type { PerfRenderer } from "./types.ts";

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Identity projection and view: the frustum is the clip cube [-1, 1]³. */
const camera = {
  layers: { mask: 1 },
  matrixWorldInverse: { elements: IDENTITY },
  projectionMatrix: { elements: IDENTITY },
};

const translate = (x: number) => ({ elements: [...IDENTITY.slice(0, 12), x, 0, 0, 1] });

let geometryId = 0;

/** Indexed geometry of `triangles` triangles, bounding sphere at the origin. */
const geometry = (triangles: number, extra: Record<string, unknown> = {}) => ({
  boundingSphere: { center: { x: 0, y: 0, z: 0 }, radius: 0.5 },
  index: { count: triangles * 3 },
  uuid: `g${(geometryId += 1)}`,
  ...extra,
});

const material = (extra: Record<string, unknown> = {}) => ({
  type: "MeshStandardMaterial",
  ...extra,
});

const mesh = (extra: Record<string, unknown> = {}) => ({
  geometry: geometry(12),
  isMesh: true,
  layers: { mask: 1 },
  material: material(),
  matrixWorld: { elements: IDENTITY },
  type: "Mesh",
  ...extra,
});

/** `traverseVisible` over a flat list: the fakes are all visible already. */
const scene = (...objects: object[]) => ({
  traverseVisible: (callback: (object: object) => void) => objects.forEach(callback),
});

describe("computeSceneCost", () => {
  test("one draw per mesh, triangles from the index", () => {
    const cost = computeSceneCost(scene(mesh({ name: "box" })), camera)!;

    expect(cost.calls).toBe(1);
    expect(cost.triangles).toBe(12);
    expect(cost.meshes[0]).toMatchObject({ calls: 1, instances: 1, label: "box", triangles: 12 });
  });

  test("an InstancedMesh is one call and multiplies triangles by its count", () => {
    const cost = computeSceneCost(
      scene(mesh({ count: 100, isInstancedMesh: true, name: "cubes" })),
      camera,
    )!;

    expect(cost.meshes[0]).toMatchObject({ calls: 1, instances: 100, triangles: 1200 });
  });

  test("copies of one mesh share a row, so unmerged duplicates stand out", () => {
    const shared = geometry(12);
    const cost = computeSceneCost(
      scene(
        mesh({ geometry: shared, name: "tree" }),
        mesh({ geometry: shared, name: "tree" }),
        mesh({ geometry: shared, name: "tree" }),
        mesh({ name: "rock" }),
      ),
      camera,
    )!;

    expect(cost.meshes.map((entry) => [entry.label, entry.calls, entry.objects.length])).toEqual([
      ["tree", 3, 3],
      ["rock", 1, 1],
    ]);
  });

  test("a material array draws once per group, and each material gets its own row", () => {
    const top = material({ name: "top" });
    const side = material({ name: "side" });
    const grouped = mesh({
      geometry: geometry(12, {
        groups: [
          { count: 18, materialIndex: 0, start: 0 },
          { count: 18, materialIndex: 1, start: 18 },
        ],
      }),
      material: [top, side],
    });
    const cost = computeSceneCost(scene(grouped), camera)!;

    expect(cost.calls).toBe(2);
    expect(cost.meshes[0]).toMatchObject({ calls: 2, triangles: 12 });
    expect(cost.materials.map((entry) => [entry.label, entry.calls, entry.triangles])).toEqual([
      ["top", 1, 6],
      ["side", 1, 6],
    ]);
  });

  test("transparent double-sided materials draw (and count triangles) twice unless forceSinglePass", () => {
    const glass = material({ side: 2, transparent: true });
    const single = material({ forceSinglePass: true, side: 2, transparent: true });

    expect(computeSceneCost(scene(mesh({ material: glass })), camera)).toMatchObject({
      calls: 2,
      triangles: 24,
    });
    expect(computeSceneCost(scene(mesh({ material: single })), camera)!.calls).toBe(1);
  });

  test("drawRange limits the triangles", () => {
    const partial = mesh({ geometry: geometry(12, { drawRange: { count: 9, start: 3 } }) });

    expect(computeSceneCost(scene(partial), camera)!.triangles).toBe(3);
  });

  test("leaves out what three wouldn't draw: off-screen, other layers, hidden materials", () => {
    const cost = computeSceneCost(
      scene(
        mesh({ matrixWorld: translate(5), name: "off-screen" }),
        mesh({ frustumCulled: false, matrixWorld: translate(5), name: "never culled" }),
        mesh({ layers: { mask: 2 }, name: "other layer" }),
        mesh({ material: material({ visible: false }), name: "hidden material" }),
        mesh({ matrixWorld: translate(1.2), name: "straddling the edge" }),
      ),
      camera,
    )!;

    expect(cost.meshes.map((entry) => entry.label).sort()).toEqual([
      "never culled",
      "straddling the edge",
    ]);
  });

  test("a degenerate camera culls nothing, as three's own test does", () => {
    const broken = {
      ...camera,
      projectionMatrix: {
        elements: IDENTITY.map((value, index) => (index === 0 ? Number.NaN : value)),
      },
    };

    expect(computeSceneCost(scene(mesh({ matrixWorld: translate(5) })), broken)!.calls).toBe(1);
  });

  test("not a scene reads null", () => {
    expect(computeSceneCost({}, camera)).toBeNull();
  });
});

describe("PerformanceMonitor.getSceneCost", () => {
  test("follows the pass with the most draw calls, not the last one", () => {
    const world = scene(mesh({ name: "world" }), mesh({ name: "world" }));
    const quad = scene(mesh({ name: "post quad" }));
    const renderer: PerfRenderer = {
      info: {
        autoReset: true,
        memory: { geometries: 0, textures: 0 },
        render: { calls: 0, lines: 0, points: 0, triangles: 0 },
        reset: () => {
          renderer.info.render.calls = 0;
        },
      },
      render: ((target: unknown) => {
        renderer.info.render.calls += target === world ? 2 : 1;
      }) as PerfRenderer["render"],
    };
    const monitor = new PerformanceMonitor({ renderer, trackGPU: false });
    const render = renderer.render as (scene: unknown, camera: unknown) => void;

    expect(monitor.getSceneCost()).toBeNull();

    monitor.begin();
    render(world, camera);
    render(quad, camera);
    monitor.end();

    expect(monitor.getSceneCost()?.meshes[0]?.label).toBe("world");
    monitor.dispose();
  });
});

describe("computeSceneCost against real three objects", () => {
  test("reads a real scene, camera and InstancedMesh, culling what's behind the camera", async () => {
    const THREE = await import("three");
    const box = new THREE.BoxGeometry();
    box.name = "box";
    const world = new THREE.Scene();

    const front = new THREE.Mesh(box, new THREE.MeshStandardMaterial());
    const behind = new THREE.Mesh(box, new THREE.MeshBasicMaterial());
    behind.position.z = 20;
    const crowd = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial(), 50);
    crowd.name = "crowd";
    world.add(front, behind, crowd);

    const view = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    view.position.z = 5;
    world.updateMatrixWorld();
    view.updateMatrixWorld();
    // three computes these while rendering; do it by hand here.
    box.computeBoundingSphere();
    crowd.computeBoundingSphere();

    const cost = computeSceneCost(world, view)!;

    // Equal calls, so triangles break the tie.

    expect(cost.calls).toBe(2);
    expect(
      cost.meshes.map((entry) => [entry.label, entry.calls, entry.triangles, entry.instances]),
    ).toEqual([
      ["crowd", 1, 600, 50],
      ["box", 1, 12, 1],
    ]);
  });
});
