/**
 * The landing page's scene: a lattice of cubes with a lemon ripple running through it, measured by
 * the real three-meter HUD docked in its corner, so the page shows the kit at work. Loaded after
 * first paint; it stops drawing while off screen, holds still under reduced motion, and leaves
 * the hero's backdrop in place if WebGL isn't there.
 */
import { PerformanceMonitor, wrapAnimationLoop } from "@zkmake/three-meter";
import { mountPerfHud, type ThemeMode } from "@zkmake/three-meter/ui";
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  InstancedMesh,
  MathUtils,
  Object3D,
  PerspectiveCamera,
  Scene,
  MeshStandardMaterial,
  WebGLRenderer,
} from "three";

/** 16³ cubes: dense enough to read as a block, light enough for a phone. */
const SIDE = 16;
const COUNT = SIDE ** 3;
const SPACING = 0.62;
const LEMON = new Color("#ffe27a");
/** Base colours by height, low to high: the page's slate into a cool violet. */
const LOW = new Color("#5d6680");
const HIGH = new Color("#b3b7f0");

type Hero = {
  setTheme: (mode: ThemeMode) => void;
  dispose: () => void;
};

const startHero = (host: HTMLElement, theme: ThemeMode): Hero => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.domElement.classList.add("hero__canvas");
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.prepend(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, host.clientWidth / host.clientHeight, 0.1, 100);
  const eye = { x: 0, y: 0 };

  scene.add(new HemisphereLight("#d7e3ff", "#14161b", 1.1));
  const key = new DirectionalLight("#fff1c4", 2.4);
  key.position.set(6, 10, 7);
  scene.add(key);
  const rim = new DirectionalLight("#9aa8ff", 0.8);
  rim.position.set(-8, -2, -6);
  scene.add(rim);

  const geometry = new BoxGeometry(0.42, 0.42, 0.42);
  const material = new MeshStandardMaterial({ roughness: 0.45, metalness: 0.1 });
  const cubes = new InstancedMesh(geometry, material, COUNT);
  cubes.name = "lattice";
  scene.add(cubes);

  // Each cube's resting place, its distance from the centre (the ripple runs outward) and its
  // base colour.
  const rest = new Float32Array(COUNT * 3);
  const radius = new Float32Array(COUNT);
  const base: Color[] = [];
  const half = (SIDE - 1) / 2;

  for (let index = 0; index < COUNT; index += 1) {
    const x = (index % SIDE) - half;
    const y = (Math.floor(index / SIDE) % SIDE) - half;
    const z = Math.floor(index / (SIDE * SIDE)) - half;

    rest.set([x * SPACING, y * SPACING, z * SPACING], index * 3);
    radius[index] = Math.hypot(x, y, z);
    base.push(LOW.clone().lerp(HIGH, (y + half) / (SIDE - 1)));
  }

  const dummy = new Object3D();
  const color = new Color();

  const place = (time: number) => {
    const t = time * 0.0016;

    for (let index = 0; index < COUNT; index += 1) {
      // A crest every ~7 cubes, travelling outward; sharpened so most of the lattice rests.
      const wave = 0.5 + 0.5 * Math.sin(radius[index]! * 0.9 - t);
      const crest = wave ** 6;

      dummy.position.set(
        rest[index * 3]!,
        rest[index * 3 + 1]! + crest * 0.22,
        rest[index * 3 + 2]!,
      );
      dummy.scale.setScalar(0.62 + 0.38 * wave);
      dummy.updateMatrix();
      cubes.setMatrixAt(index, dummy.matrix);
      cubes.setColorAt(index, color.copy(base[index]!).lerp(LEMON, crest * 0.85));
    }

    cubes.instanceMatrix.needsUpdate = true;
    cubes.instanceColor!.needsUpdate = true;
  };

  const frame = (time: number) => {
    if (!still) {
      place(time);
      cubes.rotation.y = time * 0.00008;
    }

    // Lean the camera a little toward the pointer.
    const angle = 0.75 + eye.x * 0.12;
    const lift = 9 + eye.y * 1.6;

    camera.position.set(Math.sin(angle) * 29, lift, Math.cos(angle) * 29);
    camera.lookAt(0, -0.3, 0);
    renderer.render(scene, camera);
  };

  // Held still, the frame where a crest runs across the lattice's faces.
  place(still ? 3300 : 0);

  const monitor = new PerformanceMonitor({ renderer });
  const hud = mountPerfHud(monitor, {
    parent: host,
    storageKey: null,
    theme,
    label: "Performance of this scene",
  });
  const loop = wrapAnimationLoop(monitor, frame);

  const onPointer = (event: PointerEvent) => {
    if (still || event.pointerType !== "mouse") {
      return;
    }

    const target = {
      x: MathUtils.clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1),
      y: MathUtils.clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1),
    };

    eye.x += (target.x - eye.x) * 0.08;
    eye.y += (target.y - eye.y) * 0.08;
  };

  const resize = new ResizeObserver(() => {
    const { clientWidth: width, clientHeight: height } = host;

    if (width && height) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
  });

  // Draw only while the scene is on screen.
  const visible = new IntersectionObserver(([entry]) => {
    renderer.setAnimationLoop(entry?.isIntersecting ? loop : null);
  });

  window.addEventListener("pointermove", onPointer, { passive: true });
  resize.observe(host);
  visible.observe(host);
  frame(performance.now());
  // Next frame, so the canvas's fade-in has a start to run from.
  requestAnimationFrame(() => host.classList.add("is-live"));

  return {
    setTheme: (mode) => hud.setTheme(mode),
    dispose: () => {
      window.removeEventListener("pointermove", onPointer);
      resize.disconnect();
      visible.disconnect();
      renderer.setAnimationLoop(null);
      hud.dispose();
      monitor.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
};

export { startHero };
