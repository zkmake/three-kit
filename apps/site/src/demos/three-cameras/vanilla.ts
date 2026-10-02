/**
 * Plain three, no React: `mountCameraPanel({ scene, renderer })` lists the set's cameras and the
 * orbit view, which it finds by watching `renderer.render`. `mountPerfHud` sits beside it.
 */
import { mountCameraPanel } from "@zkmake/three-cameras/ui";
import { PerformanceMonitor, wrapAnimationLoop } from "@zkmake/three-meter";
import { mountPerfHud } from "@zkmake/three-meter/ui";
import {
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { frameCamera } from "../fit.ts";
import {
  createSet,
  type DemoFactory,
  FRAMING,
  insetFrame,
  renderViews,
  seedTrack,
} from "./demo.ts";

const createVanillaDemo: DemoFactory = async (host, options) => {
  const renderer = new WebGLRenderer({ antialias: true });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.append(renderer.domElement);

  const scene = new Scene();
  const background = new Color(options.background);

  scene.background = background;
  scene.add(new HemisphereLight("#f4f1ea", "#23262d", 2));

  const sun = new DirectionalLight("#ffffff", 1.8);

  sun.position.set(4, 8, 5);
  scene.add(sun);

  const set = createSet();

  scene.add(set.group);

  const view = new PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.1, 100);

  view.name = "orbit view";

  const controls = new OrbitControls(view, renderer.domElement);

  frameCamera(view, FRAMING, controls.target);
  controls.enableDamping = true;
  controls.update();

  const frame = insetFrame(host);
  const panel = mountCameraPanel({
    scene,
    renderer,
    storageKey: `${options.storageKey}:cameras`,
    theme: options.theme,
  });

  seedTrack(panel.lab, set);
  const monitor = new PerformanceMonitor({ renderer });
  const hud = mountPerfHud(monitor, {
    storageKey: `${options.storageKey}:meter`,
    theme: options.theme,
    defaultPlacement: { edge: "left", align: "center" },
  });

  // Compile the scene's shaders before the first frame, off the main thread where the browser
  // can, so that frame doesn't stall the page.
  await renderer.compileAsync(scene, view);

  renderer.setAnimationLoop(
    wrapAnimationLoop(monitor, (time) => {
      set.update(time);
      controls.update();
      renderViews(renderer, scene, view, set.dolly, host.clientWidth, host.clientHeight);
    }),
  );

  let width = host.clientWidth;

  const onResize = () => {
    view.aspect = host.clientWidth / host.clientHeight;
    view.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
    frame.place();

    // Reframe on a new width (a turned phone), not on a browser bar sliding away mid-orbit.
    if (host.clientWidth !== width) {
      width = host.clientWidth;
      frameCamera(view, FRAMING, controls.target);
      controls.update();
    }
  };

  window.addEventListener("resize", onResize);

  return {
    dispose: () => {
      window.removeEventListener("resize", onResize);
      renderer.setAnimationLoop(null);
      panel.dispose();
      hud.dispose();
      monitor.dispose();
      controls.dispose();
      frame.remove();
      set.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
    setBackground: (hex) => {
      background.set(hex);
    },
    setTheme: (mode) => {
      hud.setTheme(mode);
      panel.setTheme(mode);
    },
  };
};

export { createVanillaDemo };
