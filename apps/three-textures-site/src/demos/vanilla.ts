/**
 * Plain three, no React: `mountTexturePanel({ scene, renderer })` for the textures and
 * `mountPerfHud` beside it, both in the same dev-panel frame. OrbitControls to get close to a swap.
 */
import { PerformanceMonitor, wrapAnimationLoop } from "@zkmake/three-meter";
import { mountPerfHud } from "@zkmake/three-meter/ui";
import { mountTexturePanel } from "@zkmake/three-textures/ui";
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  TorusKnotGeometry,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { type DemoFactory, loadTextures, STICKER_SPOTS } from "../demo.ts";

const createVanillaDemo: DemoFactory = async (host, options) => {
  const renderer = new WebGLRenderer({ antialias: true });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.append(renderer.domElement);

  const scene = new Scene();
  const background = new Color(options.background);

  scene.background = background;

  const camera = new PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 100);

  // Aimed right of the scene's middle, so it sits left of the texture panel on the right edge.
  camera.position.set(1.1, 2.6, 9.6);

  const controls = new OrbitControls(camera, renderer.domElement);

  controls.target.set(1.1, 0.9, 0);
  controls.enableDamping = true;
  controls.update();

  scene.add(new HemisphereLight("#fff4e0", "#2a2f3a", 2.2));

  const sun = new DirectionalLight("#ffffff", 1.6);

  sun.position.set(4, 8, 6);
  scene.add(sun);

  const textures = await loadTextures(renderer);
  const disposables: { dispose: () => void }[] = [];
  const add = (mesh: Mesh) => {
    disposables.push(mesh.geometry, mesh.material as MeshStandardMaterial);
    scene.add(mesh);

    return mesh;
  };

  const crate = add(
    new Mesh(new BoxGeometry(1.5, 1.5, 1.5), new MeshStandardMaterial({ map: textures.crate })),
  );

  crate.position.set(-2.6, 0.9, 0);

  const small = add(
    new Mesh(
      new BoxGeometry(0.9, 0.9, 0.9),
      new MeshStandardMaterial({ map: textures.crateTiled }),
    ),
  );

  small.position.set(-1.05, 0.55, 0.6);

  const knot = add(
    new Mesh(
      new TorusKnotGeometry(0.42, 0.16, 160, 24),
      new MeshStandardMaterial({ map: textures.noise, roughness: 0.4 }),
    ),
  );

  knot.position.set(0.2, 1.1, 0);

  const cards = STICKER_SPOTS.map(([x, y, tilt], index) => {
    const card = add(
      new Mesh(
        new PlaneGeometry(0.95, 0.95),
        new MeshStandardMaterial({ map: textures.stickers[index], roughness: 0.8 }),
      ),
    );

    card.position.set(x, y, 0);
    card.rotation.y = tilt;

    return card;
  });

  const textureKey = `${options.storageKey}:textures`;
  const panel = mountTexturePanel({
    scene,
    renderer,
    storageKey: textureKey,
    theme: options.theme,
    defaultPlacement: { edge: "right", align: "center" },
  });
  const monitor = new PerformanceMonitor({ renderer });
  const hud = mountPerfHud(monitor, {
    storageKey: `${options.storageKey}:meter`,
    theme: options.theme,
    defaultPlacement: { edge: "left", align: "center" },
  });

  renderer.setAnimationLoop(
    wrapAnimationLoop(monitor, (time) => {
      crate.rotation.y = time * 0.00025;
      knot.rotation.set(time * 0.0003, time * 0.0004, 0);
      cards.forEach((card, index) => {
        card.position.y = STICKER_SPOTS[index]![1] + Math.sin(time * 0.0012 + index) * 0.03;
      });
      controls.update();
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
      panel.dispose();
      hud.dispose();
      monitor.dispose();
      controls.dispose();

      for (const item of disposables) {
        item.dispose();
      }

      textures.dispose();
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
