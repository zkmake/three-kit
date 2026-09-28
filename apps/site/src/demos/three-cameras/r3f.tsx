/**
 * React Three Fiber: `<CameraPanel />` inside `<Canvas>` reads the scene and renderer from it, so
 * the canvas's own camera shows as live next to the set's. A priority-1 `useFrame` takes over
 * rendering to draw the dolly inset; `PerfSampler` / `PerfHud` beside it.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraPanel } from "@zkmake/three-cameras/react";
import { PerfHud, PerfSampler } from "@zkmake/three-meter/react";
import type { ThemeMode } from "@zkmake/three-meter/ui";
import { StrictMode, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { PerspectiveCamera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import {
  type CameraSet,
  createSet,
  type DemoFactory,
  insetFrame,
  renderViews,
  seedTrack,
} from "./demo.ts";

type AppProps = { background: string; storageKey: string; theme: ThemeMode };

function Controls() {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const controls = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const orbit = new OrbitControls(camera, canvas);

    orbit.target.set(0, 0.8, 0);
    orbit.enableDamping = true;
    orbit.update();
    controls.current = orbit;

    return () => orbit.dispose();
  }, [camera, canvas]);

  useFrame(() => controls.current?.update());

  return null;
}

function Set({ set }: { set: CameraSet }) {
  const host = useThree((state) => state.gl.domElement.parentElement);

  useEffect(() => {
    if (!host) {
      return;
    }

    const frame = insetFrame(host);
    const observer = new ResizeObserver(() => frame.place());

    observer.observe(host);

    return () => {
      observer.disconnect();
      frame.remove();
    };
  }, [host]);

  // Priority 1: Fiber stops drawing on its own, so this draws both views.
  useFrame(({ gl, scene, camera, size, clock }) => {
    set.update(clock.elapsedTime * 1000);
    renderViews(gl, scene, camera as PerspectiveCamera, set.dolly, size.width, size.height);
  }, 1);

  return <primitive object={set.group} />;
}

function App({ background, storageKey, theme }: AppProps) {
  const set = useMemo(() => createSet(), []);

  useEffect(() => () => set.dispose(), [set]);

  return (
    <>
      <Canvas
        camera={{ fov: 45, position: [-7, 6, 10], near: 0.1, far: 100 }}
        dpr={[1, 2]}
        onCreated={({ camera }) => {
          camera.name = "orbit view";
        }}
      >
        <color attach="background" args={[background]} />
        <hemisphereLight args={["#f4f1ea", "#23262d", 2]} />
        <directionalLight position={[4, 8, 5]} intensity={1.8} />
        <Controls />
        <Set set={set} />
        <PerfSampler />
        <CameraPanel
          storageKey={`${storageKey}:cameras`}
          theme={theme}
          onReady={(lab) => seedTrack(lab, set)}
        />
      </Canvas>
      <PerfHud
        storageKey={`${storageKey}:meter`}
        theme={theme}
        defaultPlacement={{ edge: "left", align: "center" }}
      />
    </>
  );
}

const createR3fDemo: DemoFactory = async (host, options) => {
  const root = createRoot(host);
  const props: AppProps = { ...options };

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
