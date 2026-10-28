import type { CanvasProps } from "@react-three/fiber";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { StrictMode } from "react";
import { type Camera, type Group, type Mesh, Vector3 } from "three";
import { expect, test } from "vitest";

import { resolveStudio, type StudioConfig } from "../core/state.ts";
import type { StudioHandle } from "../ui/mount.ts";
import { type StudioReactVariant, StudioRig, useStudio, useStudioTime } from "./index.tsx";

// Tells React the renderer drives act() itself.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function Crate() {
  const { tag } = useStudio();
  const time = useStudioTime();

  return (
    <mesh name={tag} position={[time(99), 0, 0]}>
      <boxGeometry />
    </mesh>
  );
}

const CONFIG: StudioConfig<StudioReactVariant> = {
  views: { play: { position: [0, 2, 10], target: [0, 2, 0], fov: 30 } },
  areas: {
    crates: {
      views: { side: { position: [6, 0, 0], target: [0, 0, 0] } },
      variants: { wood: { render: () => <Crate /> } },
    },
  },
};

const forward = (of: Camera) => of.getWorldDirection(new Vector3());

test("<StudioRig> puts the camera at the view, shares the state, and switches views", async () => {
  const state = resolveStudio(CONFIG, "?t=3");
  let studio: StudioHandle | undefined;
  const renderer = await ReactThreeTestRenderer.create(
    <StrictMode>
      <StudioRig
        state={state}
        controls={false}
        overlay={false}
        audit={false}
        onReady={(handle) => (studio = handle)}
      >
        <group userData={{ studioObject: state.tag }}>{state.variant.render(state)}</group>
      </StudioRig>
    </StrictMode>,
  );
  const scene = renderer.scene.instance as unknown as Group;
  const crate = scene.getObjectByName("crates-wood") as Mesh;

  // `?t=3` freezes the variant's clock.
  expect(crate.position.x).toBe(3);
  expect(crate.parent?.userData.studioObject).toBe("crates-wood");

  expect(studio!.camera.position.toArray()).toEqual([0, 2, 10]);
  expect(forward(studio!.camera).z).toBeCloseTo(-1);
  expect((studio!.camera as Camera & { fov: number }).fov).toBe(30);

  studio!.setView("side");
  expect(studio!.camera.position.toArray()).toEqual([6, 0, 0]);
  expect(forward(studio!.camera).x).toBeCloseTo(-1);
  expect(() => studio!.setView("drone")).toThrow(/no view "drone"; this page has play, side/);
  expect(studio!.stats()).toMatch(/^\d+ calls · [\d,]+ tris$/);

  await renderer.unmount();
});

test("<Studio> mounts the Canvas it's given, with the game's settings and the view's lens", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { Studio } = await import("./index.tsx");
  const mounted: CanvasProps[] = [];
  const Probe = (props: CanvasProps) => {
    mounted.push(props);

    return null;
  };

  renderToStaticMarkup(
    <Studio
      config={CONFIG}
      search="?crates"
      Canvas={Probe}
      canvas={{ dpr: 1, gl: { alpha: true } }}
    />,
  );

  expect(mounted).toHaveLength(1);
  expect(mounted[0]).toMatchObject({
    dpr: 1,
    gl: { preserveDrawingBuffer: true, alpha: true },
    camera: { fov: 30, position: [0, 2, 10] },
  });
});
