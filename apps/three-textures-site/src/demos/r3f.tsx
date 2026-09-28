/**
 * React Three Fiber: `<TexturePanel />` inside `<Canvas>` reads the scene and renderer from it;
 * three-meter's `PerfSampler` / `PerfHud` beside it, in the same dev-panel frame.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerfHud, PerfSampler } from "@zkmake/three-meter/react";
import type { ThemeMode } from "@zkmake/three-meter/ui";
import { TexturePanel } from "@zkmake/three-textures/react";
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Group, Mesh } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { type DemoFactory, loadTextures, type SceneTextures, STICKER_SPOTS } from "../demo.ts";

type AppProps = { background: string; storageKey: string; theme: ThemeMode };

function Controls() {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const controls = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const orbit = new OrbitControls(camera, canvas);

    orbit.target.set(1.1, 0.9, 0);
    orbit.enableDamping = true;
    orbit.update();
    controls.current = orbit;

    return () => orbit.dispose();
  }, [camera, canvas]);

  useFrame(() => controls.current?.update());

  return null;
}

function Things({ textures }: { textures: SceneTextures }) {
  const crate = useRef<Mesh>(null);
  const knot = useRef<Mesh>(null);
  const cards = useRef<Group>(null);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime * 1000;

    crate.current?.rotation.set(0, time * 0.00025, 0);
    knot.current?.rotation.set(time * 0.0003, time * 0.0004, 0);
    cards.current?.children.forEach((card, index) => {
      card.position.y = STICKER_SPOTS[index]![1] + Math.sin(time * 0.0012 + index) * 0.03;
    });
  });

  return (
    <>
      <mesh ref={crate} position={[-2.6, 0.9, 0]}>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <meshStandardMaterial map={textures.crate} />
      </mesh>
      <mesh position={[-1.05, 0.55, 0.6]}>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial map={textures.crateTiled} />
      </mesh>
      <mesh ref={knot} position={[0.2, 1.1, 0]}>
        <torusKnotGeometry args={[0.42, 0.16, 160, 24]} />
        <meshStandardMaterial map={textures.noise} roughness={0.4} />
      </mesh>
      <group ref={cards}>
        {STICKER_SPOTS.map(([x, y, tilt], index) => (
          <mesh key={index} position={[x, y, 0]} rotation={[0, tilt, 0]}>
            <planeGeometry args={[0.95, 0.95]} />
            <meshStandardMaterial map={textures.stickers[index]} roughness={0.8} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/** The textures need the renderer (KTX2 picks a format the GPU supports), so they load in here. */
function Scene() {
  const gl = useThree((state) => state.gl);
  const [textures, setTextures] = useState<SceneTextures | null>(null);

  useEffect(() => {
    let loaded: SceneTextures | null = null;
    let cancelled = false;

    void loadTextures(gl).then((next) => {
      if (cancelled) {
        next.dispose();
      } else {
        loaded = next;
        setTextures(next);
      }
    });

    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [gl]);

  return textures ? <Things textures={textures} /> : null;
}

function App({ background, storageKey, theme }: AppProps) {
  return (
    <>
      {/* Aimed right of the scene's middle, so it sits left of the texture panel on the right edge. */}
      <Canvas camera={{ fov: 42, position: [1.1, 2.6, 9.6] }} dpr={[1, 2]}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={["#fff4e0", "#2a2f3a", 2.2]} />
        <directionalLight position={[4, 8, 6]} intensity={1.6} />
        <Controls />
        <Scene />
        <PerfSampler />
        <TexturePanel
          storageKey={`${storageKey}:textures`}
          theme={theme}
          defaultPlacement={{ edge: "right", align: "center" }}
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
