import {
  BoxGeometry,
  type Camera,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  type Object3D,
  PerspectiveCamera,
  Scene,
} from "three";
import { describe, expect, test } from "vitest";

import { beginDrawLedger, type LedgerRenderer, ledgerTable } from "./draw-ledger.ts";

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
        this.renderBufferDirect(camera, null, mesh.geometry, depth, mesh, null);
      }

      for (const mesh of meshes) {
        this.renderBufferDirect(camera, null, mesh.geometry, mesh.material as never, mesh, null);
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
      { name: "wagon", total: 3, passes: { shadow: 1, "render 1": 2 } },
      { name: "grass", total: 1, passes: { "render 1": 1 } },
      { name: "sign", total: 1, passes: { overlay: 1 } },
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

  test("unnamed objects file under type and material", () => {
    const renderer = fakeRenderer();
    const recording = beginDrawLedger(renderer, { groupOf: () => "all" });
    const box = mesh("");

    box.material.name = "brick";
    renderer.render(new Scene().add(box), new PerspectiveCamera());

    const ledger = recording.end();

    expect(ledger.objects[0]!.name).toBe("Mesh:brick");
    expect(ledger.groups[0]!.name).toBe("all");
  });

  test("ledgerTable flattens passes into columns", () => {
    expect(
      ledgerTable([{ name: "a", total: 2, passes: { shadow: 2 } }], ["shadow", "render 1"]),
    ).toEqual([{ name: "a", shadow: 2, "render 1": 0, total: 2 }]);
  });

  test("refuses a renderer with no renderBufferDirect", () => {
    expect(() => beginDrawLedger({ render: () => {} } as unknown as LedgerRenderer)).toThrow(
      /WebGLRenderer/,
    );
  });
});
