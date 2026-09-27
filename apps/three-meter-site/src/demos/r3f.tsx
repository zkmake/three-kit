/**
 * React Three Fiber: `PerfSampler` lives inside `<Canvas>` and brackets
 * frames; `PerfHud` sits outside it and mounts only while a sampler is
 * publishing. `p` toggles the sampler, which shows the HUD coming and going
 * without the canvas remounting. With `webgpu` the `gl` factory hands Fiber a
 * `WebGPURenderer`.
 */
import { Canvas, type GLProps, useFrame } from "@react-three/fiber";
import { PerfHud, PerfSampler } from "@zkmake/three-meter/react";
import type { ThemeMode } from "@zkmake/three-meter/ui";
import { StrictMode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Color, type InstancedMesh, Matrix4 } from "three";

import { type DemoFactory, gridPosition, HUD_BUDGETS } from "../demo.ts";

type SceneProps = {
  background: string;
  count: number;
  storageKey: string;
  theme: ThemeMode;
  webgpu: boolean;
};

// Fiber's async `gl` factory signature; the props type itself isn't exported.
type GlFactory = Extract<GLProps, (defaultProps: never) => Promise<unknown>>;

const createWebgpuRenderer: GlFactory = async ({ canvas }) => {
  const { WebGPURenderer } = await import("three/webgpu");
  const renderer = new WebGPURenderer({
    antialias: true,
    canvas: canvas as HTMLCanvasElement,
    trackTimestamp: true,
  });
  await renderer.init();

  return renderer;
};

function Cubes({ count }: { count: number }) {
  const mesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const cubes = mesh.current;

    if (!cubes) {
      return;
    }

    const matrix = new Matrix4();
    const color = new Color();

    for (let index = 0; index < count; index += 1) {
      matrix.makeTranslation(...gridPosition(index, count));
      cubes.setMatrixAt(index, matrix);
      cubes.setColorAt(index, color.setHSL(index / count, 0.6, 0.55));
    }

    cubes.instanceMatrix.needsUpdate = true;

    if (cubes.instanceColor) {
      cubes.instanceColor.needsUpdate = true;
    }
  }, [count]);

  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.rotation.y = clock.elapsedTime * 0.2;
      mesh.current.rotation.x = Math.sin(clock.elapsedTime * 0.1) * 0.3;
    }
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} key={count} name="cubes">
      <boxGeometry args={[0.4, 0.4, 0.4]} />
      <meshStandardMaterial roughness={0.5} />
    </instancedMesh>
  );
}

function App({ background, count, storageKey, theme, webgpu }: SceneProps) {
  const [perf, setPerf] = useState(true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "p") {
        setPerf((on) => !on);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Canvas
        camera={{ fov: 50, position: [0, 6, 18] }}
        dpr={[1, 2]}
        gl={webgpu ? createWebgpuRenderer : undefined}
      >
        <color attach="background" args={[background]} />
        <hemisphereLight args={["#cfe4ff", "#1b1d24", 1.2]} />
        <directionalLight position={[5, 10, 4]} intensity={2} />
        <Cubes count={count} />
        {perf && <PerfSampler />}
      </Canvas>
      <PerfHud budgets={HUD_BUDGETS} storageKey={storageKey} theme={theme} />
    </>
  );
}

const createR3fDemo: DemoFactory = async (host, options) => {
  const root = createRoot(host);
  const props: SceneProps = {
    background: options.background,
    count: options.count,
    storageKey: options.storageKey,
    theme: options.theme,
    webgpu: options.webgpu,
  };

  const render = () => {
    root.render(
      <StrictMode>
        <App {...props} />
      </StrictMode>,
    );
  };

  render();

  return {
    dispose: () => {
      root.unmount();
    },
    setBackground: (hex) => {
      props.background = hex;
      render();
    },
    setTheme: (mode) => {
      props.theme = mode;
      render();
    },
  };
};

export { createR3fDemo };
