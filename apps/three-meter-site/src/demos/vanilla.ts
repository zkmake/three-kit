/**
 * Plain three, no React: `PerformanceMonitor` brackets the animation loop
 * through `wrapAnimationLoop`, and `mountPerfHud` draws the card. With
 * `webgpu` the renderer is `WebGPURenderer` with timestamp tracking so the GPU
 * row is real there too; `WebGLRenderer`'s GPU row needs
 * `EXT_disjoint_timer_query_webgl2` (Chrome, Edge).
 */
import { PerformanceMonitor, wrapAnimationLoop, type PerfRenderer } from "@zkmake/three-meter";
import { mountPerfHud } from "@zkmake/three-meter/ui";
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";

import { type DemoFactory, gridPosition, HUD_BUDGETS } from "../demo.ts";

type Loop = (time: number) => void;

type RendererLike = PerfRenderer & {
  domElement: HTMLCanvasElement;
  dispose: () => void;
  setAnimationLoop: (loop: Loop | null) => void;
  setPixelRatio: (ratio: number) => void;
  setSize: (width: number, height: number) => void;
  render: (scene: Scene, camera: PerspectiveCamera) => unknown;
};

const createRenderer = async (webgpu: boolean): Promise<RendererLike> => {
  if (webgpu) {
    const { WebGPURenderer } = await import("three/webgpu");
    const renderer = new WebGPURenderer({ antialias: true, trackTimestamp: true });
    await renderer.init();

    return renderer as unknown as RendererLike;
  }

  return new WebGLRenderer({ antialias: true }) as unknown as RendererLike;
};

const createVanillaDemo: DemoFactory = async (host, options) => {
  const renderer = await createRenderer(options.webgpu);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.append(renderer.domElement);

  const scene = new Scene();
  const background = new Color(options.background);
  scene.background = background;
  const camera = new PerspectiveCamera(50, host.clientWidth / host.clientHeight, 0.1, 100);
  camera.position.set(0, 6, 18);
  camera.lookAt(0, 0, 0);

  scene.add(new HemisphereLight("#cfe4ff", "#1b1d24", 1.2));
  const sun = new DirectionalLight("#ffffff", 2);
  sun.position.set(5, 10, 4);
  scene.add(sun);

  const geometry = new BoxGeometry(0.4, 0.4, 0.4);
  const material = new MeshStandardMaterial({ roughness: 0.5 });
  const cubes = new InstancedMesh(geometry, material, options.count);
  cubes.name = "cubes";
  const matrix = new Matrix4();
  const color = new Color();

  for (let index = 0; index < options.count; index += 1) {
    matrix.makeTranslation(...gridPosition(index, options.count));
    cubes.setMatrixAt(index, matrix);
    cubes.setColorAt(index, color.setHSL(index / options.count, 0.6, 0.55));
  }

  scene.add(cubes);

  const monitor = new PerformanceMonitor({ renderer });
  const hud = mountPerfHud(monitor, {
    budgets: HUD_BUDGETS,
    storageKey: options.storageKey,
    theme: options.theme,
  });

  renderer.setAnimationLoop(
    wrapAnimationLoop(monitor, (time) => {
      cubes.rotation.y = time * 0.0002;
      cubes.rotation.x = Math.sin(time * 0.0001) * 0.3;
      renderer.render(scene, camera);
    }),
  );

  const onResize = () => {
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
  };

  window.addEventListener("resize", onResize);

  return {
    dispose: () => {
      window.removeEventListener("resize", onResize);
      renderer.setAnimationLoop(null);
      hud.dispose();
      monitor.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
    setBackground: (hex) => {
      background.set(hex);
    },
    setTheme: (mode) => {
      hud.setTheme(mode);
    },
  };
};

export { createVanillaDemo };
