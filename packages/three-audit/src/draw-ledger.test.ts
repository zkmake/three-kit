import {
  BatchedMesh,
  BoxGeometry,
  BufferGeometry,
  type Camera,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  type Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
} from "three";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  beginDrawLedger,
  type LedgerRenderer,
  ledgerTable,
  recordDrawLedger,
} from "./draw-ledger.ts";

/**
 * Stands in for WebGLRenderer: `render()` draws a shadow of every mesh, then every mesh, through
 * `renderBufferDirect`, the way three does. Methods are own properties, like three's.
 */
const fakeRenderer = () => {
  const depth = new MeshDepthMaterial();
  const renderer: LedgerRenderer & { drawn: number } = {
    drawn: 0,
    render(scene: Object3D, camera: Camera) {
      const meshes: Mesh[] = [];

      scene.traverse((object) => {
        if ((object as Mesh).isMesh) {
          meshes.push(object as Mesh);
        }
      });

      for (const mesh of meshes.filter((m) => m.castShadow)) {
        this.renderBufferDirect!(camera, null, mesh.geometry, depth, mesh, null);
      }

      for (const mesh of meshes) {
        this.renderBufferDirect!(camera, null, mesh.geometry, mesh.material as never, mesh, null);
      }
    },
    renderBufferDirect() {
      renderer.drawn += 1;
    },
  };

  return renderer;
};

const mesh = (name: string, castShadow = false) => {
  const object = new Mesh(new BoxGeometry(), new MeshBasicMaterial());

  object.name = name;
  object.castShadow = castShadow;

  return object;
};

/** `WebGPURenderer.info`: `update` lives on the prototype, as it does in three. */
class FakeInfo {
  calls = 0;

  update(_object: Object3D, _count: number, _instanceCount: number) {
    this.calls += 1;
  }
}

const OUTPUT = { width: 800, height: 600, texture: { name: "output" } };
const UNNAMED = { width: 800, height: 600, texture: { name: "" } };
const SHADOW = {
  width: 1024,
  height: 1024,
  texture: { name: "ShadowMap" },
  depthTexture: { name: "ShadowDepthTexture" },
};

/**
 * Stands in for WebGPURenderer: draws report to `info.update`, and a pass renders its shadow map
 * from inside its own `render()`, through the same `render`, the way ShadowNode does.
 */
const fakeWebGPURenderer = (shadowTarget: object = SHADOW) => {
  let target: object | null = null;
  const info = new FakeInfo();
  const renderer = {
    info,
    domElement: { width: 1600, height: 1200 },
    getRenderTarget: () => target,
    setRenderTarget(next: object | null) {
      target = next;
    },
    render(scene: Object3D, camera: Camera) {
      if (target === OUTPUT || target === UNNAMED) {
        const outer = target;
        const { name } = scene;

        // ShadowNode names the scene for as long as it draws the shadow map.
        scene.name = "Shadow Map [ ID: 7 ]";
        target = shadowTarget;
        renderer.render(scene, camera);
        target = outer;
        scene.name = name;
      }

      scene.traverse((object) => {
        const drawn = object as Mesh & { count?: number };

        if (drawn.isMesh && (target !== shadowTarget || drawn.castShadow)) {
          const count = drawn.geometry.index?.count ?? drawn.geometry.attributes.position!.count;

          info.update(drawn, count, drawn.count ?? 1);
        }
      });
    },
  };

  return renderer;
};

describe("draw ledger", () => {
  test("counts draws by object, group and pass, then restores the renderer", () => {
    const renderer = fakeRenderer();
    const { render, renderBufferDirect } = renderer;
    const camera = new PerspectiveCamera();
    const world = new Scene().add(mesh("wagon:paint", true), mesh("wagon:trim"), mesh("grass#3"));
    const overlay = new Scene().add(mesh("sign"));

    overlay.name = "overlay";

    const recording = beginDrawLedger(renderer);

    renderer.render(world, camera);
    renderer.render(overlay, camera);

    const ledger = recording.end();

    expect(ledger.draws).toBe(5);
    expect(renderer.drawn).toBe(5);
    expect(ledger.passes).toEqual(["shadow", "render 1", "overlay"]);
    expect(ledger.groups).toEqual([
      {
        name: "wagon",
        total: 3,
        passes: { shadow: 1, "render 1": 2 },
        triangles: 36,
        passTriangles: { shadow: 12, "render 1": 24 },
      },
      {
        name: "grass",
        total: 1,
        passes: { "render 1": 1 },
        triangles: 12,
        passTriangles: { "render 1": 12 },
      },
      {
        name: "sign",
        total: 1,
        passes: { overlay: 1 },
        triangles: 12,
        passTriangles: { overlay: 12 },
      },
    ]);
    expect(ledger.objects.map((row) => row.name)).toEqual([
      "wagon:paint",
      "wagon:trim",
      "grass#3",
      "sign",
    ]);
    expect(renderer.render).toBe(render);
    expect(renderer.renderBufferDirect).toBe(renderBufferDirect);
  });

  test("unnamed objects file under their named ancestors, type and material", () => {
    const renderer = fakeRenderer();
    const recording = beginDrawLedger(renderer, { groupOf: () => "all" });
    const box = mesh("");
    const loose = mesh("");
    const hands = new Group();

    hands.name = "CharacterHands";
    box.material.name = "brick";
    renderer.render(new Scene().add(hands.add(box), loose), new PerspectiveCamera());

    const ledger = recording.end();

    expect(ledger.objects.map((row) => row.name)).toEqual([
      "CharacterHands/Mesh [brick]",
      "Mesh [MeshBasicMaterial]",
    ]);
    expect(ledger.groups[0]!.name).toBe("all");
  });

  describe("recordDrawLedger", () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    test("with render, records that one call without waiting for a frame", async () => {
      const renderer = fakeRenderer();
      const world = new Scene().add(mesh("crate"));

      vi.stubGlobal("requestAnimationFrame", () => {
        throw new Error("no frames here");
      });

      const ledger = await recordDrawLedger(renderer, {
        render: () => renderer.render(world, new PerspectiveCamera()),
      });

      expect(ledger.objects.map((row) => row.name)).toEqual(["crate"]);
    });

    test("fails after the timeout when no frame comes, and says why", async () => {
      vi.useFakeTimers();
      vi.stubGlobal("requestAnimationFrame", () => 1);
      vi.stubGlobal("cancelAnimationFrame", () => {});
      vi.stubGlobal("document", { hidden: true });

      const recorded = recordDrawLedger(fakeRenderer(), { timeout: 500 });
      const failed = expect(recorded).rejects.toThrow(
        /no animation frame in 0.5 s.*hidden.*render/,
      );

      await vi.advanceTimersByTimeAsync(500);
      await failed;
    });

    test("restores the renderer when the second frame never comes", async () => {
      vi.useFakeTimers();

      let frames = 0;

      vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        frames += 1;

        if (frames === 1) {
          queueMicrotask(() => callback(0));
        }

        return frames;
      });
      vi.stubGlobal("cancelAnimationFrame", () => {});

      const renderer = fakeRenderer();
      const { render } = renderer;
      const recorded = recordDrawLedger(renderer);
      const failed = expect(recorded).rejects.toThrow(/no animation frame/);

      await vi.advanceTimersByTimeAsync(2000);
      await failed;
      expect(renderer.render).toBe(render);
    });
  });

  test("sizes each pass: triangles, casters, targets, and fullscreen post passes", () => {
    const renderer = Object.assign(fakeRenderer(), {
      target: null as { width: number; height: number } | null,
      getRenderTarget() {
        return this.target;
      },
      getContext: () => ({ drawingBufferWidth: 2880, drawingBufferHeight: 1800 }),
    });
    const world = new Scene().add(mesh("monster", true), mesh("hands", true), mesh("ground"));
    const triangle = new BufferGeometry().setAttribute(
      "position",
      new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    const quad = new Mesh(triangle, new MeshBasicMaterial());
    const flat = new OrthographicCamera();
    const recording = beginDrawLedger(renderer);

    renderer.target = { width: 2880, height: 1800 };
    renderer.render(world, new PerspectiveCamera());
    renderer.render(quad, flat);
    renderer.target = null;
    renderer.render(quad, flat);

    const ledger = recording.end();

    expect(ledger.passStats).toEqual([
      {
        name: "shadow",
        draws: 2,
        objects: 2,
        triangles: 24,
        targets: ["2880×1800"],
        fullscreen: false,
      },
      {
        name: "render 1",
        draws: 3,
        objects: 3,
        triangles: 36,
        targets: ["2880×1800"],
        fullscreen: false,
      },
      {
        name: "render 2",
        draws: 1,
        objects: 1,
        triangles: 1,
        targets: ["2880×1800"],
        fullscreen: true,
      },
      {
        name: "render 3",
        draws: 1,
        objects: 1,
        triangles: 1,
        targets: ["screen 2880×1800"],
        fullscreen: true,
      },
    ]);
    expect(ledger.fullscreenPasses).toBe(2);
    expect(ledger.fullscreenPixels).toBe(2 * 2880 * 1800);
  });

  test("a batch's triangles are the instances three kept after culling them", () => {
    const renderer = fakeRenderer();
    const city = new BatchedMesh(3, 100, 100, new MeshBasicMaterial());
    const box = city.addGeometry(new BoxGeometry());

    city.name = "city";

    for (let index = 0; index < 3; index += 1) {
      city.addInstance(box);
    }

    const recording = beginDrawLedger(renderer);

    // What three's onBeforeRender leaves after per-instance culling: one box of three.
    Object.assign(city, { _multiDrawCounts: new Int32Array([36, 0, 0]), _multiDrawCount: 1 });
    renderer.render(new Scene().add(city), new PerspectiveCamera());

    expect(recording.end().objects[0]).toMatchObject({ name: "city", triangles: 12 });
  });

  test("ledgerTable flattens passes into columns", () => {
    expect(
      ledgerTable(
        [
          {
            name: "a",
            total: 2,
            passes: { shadow: 2 },
            triangles: 24,
            passTriangles: { shadow: 24 },
          },
        ],
        ["shadow", "render 1"],
      ),
    ).toEqual([{ name: "a", shadow: 2, "render 1": 0, total: 2, triangles: 24 }]);
  });

  test("refuses a renderer with no renderBufferDirect", () => {
    expect(() => beginDrawLedger({ render: () => {} } as unknown as LedgerRenderer)).toThrow(
      /WebGLRenderer/,
    );
  });

  test("on WebGPU, counts what info hears, by target, then restores it", () => {
    const renderer = fakeWebGPURenderer();
    const { render } = renderer;
    const scene = new Scene();
    const grass = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 10);
    const quad = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial());
    const unnamed = mesh("", true);

    grass.name = "grass#3";
    quad.name = "Render Pipeline";
    scene.add(mesh("wagon:paint", true), grass, unnamed);

    const recording = beginDrawLedger(renderer);

    renderer.setRenderTarget(OUTPUT);
    renderer.render(scene, new PerspectiveCamera());
    renderer.setRenderTarget(null);
    renderer.render(quad, new OrthographicCamera());

    const ledger = recording.end();

    expect(ledger.passes).toEqual(["shadow", "output", "Render Pipeline"]);
    expect(ledger.draws).toBe(6);
    expect(ledger.objects.find((row) => row.name === "Mesh [MeshBasicMaterial]")).toMatchObject({
      total: 2,
      passes: { shadow: 1, output: 1 },
    });
    expect(ledger.groups.find((row) => row.name === "wagon")).toMatchObject({
      total: 2,
      passes: { shadow: 1, output: 1 },
      triangles: 24,
    });
    expect(ledger.objects.find((row) => row.name === "grass#3")).toMatchObject({
      total: 1,
      triangles: 120,
    });
    expect(ledger.passStats).toMatchObject([
      { name: "shadow", draws: 2, objects: 2, triangles: 24, targets: ["1024×1024"] },
      { name: "output", draws: 3, triangles: 144, targets: ["800×600"], fullscreen: false },
      { name: "Render Pipeline", draws: 1, targets: ["screen 1600×1200"], fullscreen: true },
    ]);
    expect(ledger.fullscreenPasses).toBe(1);
    expect(ledger.fullscreenPixels).toBe(1600 * 1200);
    expect(ledger.objects.map((row) => row.name)).toEqual(
      expect.not.arrayContaining([expect.stringContaining("Shadow Map")]),
    );

    // Forwarded every draw, and put back what was there.
    expect(renderer.info.calls).toBe(6);
    expect(Object.hasOwn(renderer.info, "update")).toBe(false);
    expect(renderer.render).toBe(render);
  });

  test("on WebGPU, a point light's shadow map is a shadow, and shadows don't number passes", () => {
    const renderer = fakeWebGPURenderer({
      width: 512,
      height: 512,
      texture: { name: "PointShadowMap" },
      depthTexture: { name: "PointShadowDepthTexture" },
    });
    const scene = new Scene();

    scene.add(mesh("", true));

    const recording = beginDrawLedger(renderer);

    renderer.setRenderTarget(UNNAMED);
    renderer.render(scene, new PerspectiveCamera());
    renderer.render(scene, new PerspectiveCamera());

    const ledger = recording.end();

    expect(ledger.passes).toEqual(["shadow", "render 1", "render 2"]);
    expect(ledger.objects.map((row) => row.name)).toEqual(["Mesh [MeshBasicMaterial]"]);
  });
});
