/**
 * The landing page's scene: a lattice of cubes with a lemon ripple running through it, measured by
 * the real three-meter HUD docked in its corner, so the page shows the kit at work. The cubes are
 * placed once; the ripple runs in the vertex shader, so a frame uploads a few uniforms rather
 * than every instance. Hovering or tapping the lattice sends a ripple out from that cube (up to
 * four at once). Loaded after first paint; it stops drawing while off screen, holds still (and
 * takes no ripples) under reduced motion, and leaves the hero's poster in place without WebGL.
 */
import { PerformanceMonitor, wrapAnimationLoop } from "@zkmake/three-meter";
import { mountPerfHud, type ThemeMode } from "@zkmake/three-meter/ui";
import {
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  Matrix4,
  MeshLambertMaterial,
  PerspectiveCamera,
  Ray,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";

/** 16³ cubes: dense enough to read as a block, light enough for a phone. */
const SIDE = 16;
const COUNT = SIDE ** 3;
const SPACING = 0.62;
const LEMON = new Color("#ffe27a");
/** Ripple speed, in radians of phase per millisecond. */
const SPEED = 0.0016;
/**
 * Held still (reduced motion, and the poster), the moment a crest rings each outer face while the
 * core is dark, so nothing glows through the gaps between cubes.
 */
const STILL_TIME = 900;
/** Pointer ripples at once; a fifth replaces the oldest. */
const RIPPLES = 4;
/** A pointer ripple's speed in cubes a second, and how long it lasts. */
const RIPPLE_SPEED = 9;
const RIPPLE_SECONDS = 1.8;
/** A hover sends a new ripple at most this often, and only once it has moved to another cube. */
const HOVER_MS = 320;
/** Base colours by height, low to high: the page's slate into a cool violet. */
const LOW = new Color("#5d6680");
const HIGH = new Color("#b3b7f0");

type Hero = {
  setTheme: (mode: ThemeMode) => void;
  dispose: () => void;
};

const startHero = async (host: HTMLElement, theme: ThemeMode): Promise<Hero> => {
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
  const material = new MeshLambertMaterial();
  // Pointer ripples: a centre in lattice cells (xyz) and a start time in seconds (w); w < 0 is off.
  const ripples = Array.from({ length: RIPPLES }, () => new Vector4(0, 0, 0, -100));
  const uniforms = {
    uTime: { value: 0 },
    uNow: { value: 0 },
    uLemon: { value: LEMON },
    uRipples: { value: ripples },
  };
  const cubes = new InstancedMesh(geometry, material, COUNT);
  cubes.name = "lattice";
  // The shader moves vertices past the instances' bounds; the lattice is always in view anyway.
  cubes.frustumCulled = false;
  scene.add(cubes);

  // Each cube's resting place and base colour, set once; its distance from the centre (the ripple
  // runs outward) goes to the shader as a per-instance attribute.
  const radius = new Float32Array(COUNT);
  const cell = new Float32Array(COUNT * 3);
  const matrix = new Matrix4();
  const color = new Color();
  const half = (SIDE - 1) / 2;

  for (let index = 0; index < COUNT; index += 1) {
    const x = (index % SIDE) - half;
    const y = (Math.floor(index / SIDE) % SIDE) - half;
    const z = Math.floor(index / (SIDE * SIDE)) - half;

    cubes.setMatrixAt(index, matrix.makeTranslation(x * SPACING, y * SPACING, z * SPACING));
    cubes.setColorAt(index, color.copy(LOW).lerp(HIGH, (y + half) / (SIDE - 1)));
    radius[index] = Math.hypot(x, y, z);
    cell.set([x, y, z], index * 3);
  }

  geometry.setAttribute("aRadius", new InstancedBufferAttribute(radius, 1));
  geometry.setAttribute("aCell", new InstancedBufferAttribute(cell, 3));

  // A crest every ~7 cubes, travelling outward; sharpened so most of the lattice rests. A pointer
  // ripple is one ring growing from its cube and fading. Either swells a cube, lifts it and tints
  // it lemon.
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float aRadius;
        attribute vec3 aCell;
        uniform float uTime;
        uniform float uNow;
        uniform vec4 uRipples[${RIPPLES}];
        varying float vCrest;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float wave = 0.5 + 0.5 * sin(aRadius * 0.9 - uTime);
        float crest = pow(wave, 6.0);
        for (int i = 0; i < ${RIPPLES}; i++) {
          float age = uNow - uRipples[i].w;
          if (age >= 0.0 && age < ${RIPPLE_SECONDS.toFixed(1)}) {
            float ring = distance(aCell, uRipples[i].xyz) - age * ${RIPPLE_SPEED.toFixed(1)};
            float pulse = exp(-ring * ring * 0.6) * (1.0 - age / ${RIPPLE_SECONDS.toFixed(1)});
            crest = max(crest, pulse);
            wave = max(wave, pulse);
          }
        }
        vCrest = crest;
        transformed *= 0.62 + 0.38 * wave;
        transformed.y += vCrest * 0.22;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uLemon;\nvarying float vCrest;",
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uLemon, vCrest * 0.85);",
      );
  };

  const frame = (time: number) => {
    if (!still) {
      uniforms.uTime.value = time * SPEED;
      uniforms.uNow.value = time / 1000;
      cubes.rotation.y = time * 0.00008;
    }

    // Lean the camera a little toward the pointer.
    const angle = 0.75 + eye.x * 0.12;
    const lift = 9 + eye.y * 1.6;

    camera.position.set(Math.sin(angle) * 29, lift, Math.cos(angle) * 29);
    camera.lookAt(0, -0.3, 0);
    renderer.render(scene, camera);
  };

  uniforms.uTime.value = (still ? STILL_TIME : 0) * SPEED;

  const monitor = new PerformanceMonitor({ renderer });
  // The HUD sits in the hero's meter row, beside the caption that says what it's measuring.
  const meter = host.querySelector<HTMLElement>("[data-hero-meter]") ?? host;
  const count = host.querySelector("[data-cube-count]");

  if (count) {
    count.textContent = COUNT.toLocaleString("en");
  }

  // No budgets: on a slow machine the numbers read as numbers, not an amber warning on the page.
  const hud = mountPerfHud(monitor, {
    parent: meter,
    storageKey: null,
    theme,
    budgets: false,
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

  // The cube under the pointer: the ray in the lattice's own space, against its box, then the
  // first occupied cell along it (every cell is, so the box's entry point, snapped).
  const raycaster = new Raycaster();
  const ray = new Ray();
  const ndc = new Vector2();
  const hit = new Vector3();
  const bounds = new Box3(
    new Vector3(-half - 0.5, -half - 0.5, -half - 0.5).multiplyScalar(SPACING),
    new Vector3(half + 0.5, half + 0.5, half + 0.5).multiplyScalar(SPACING),
  );
  let next = 0;
  let lastCell = "";
  let lastHover = 0;

  const rippleAt = (event: PointerEvent, hover: boolean) => {
    if (still) {
      return;
    }

    const box = renderer.domElement.getBoundingClientRect();

    ndc.set(
      ((event.clientX - box.left) / box.width) * 2 - 1,
      -((event.clientY - box.top) / box.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    ray.copy(raycaster.ray).applyMatrix4(matrix.copy(cubes.matrixWorld).invert());

    if (!ray.intersectBox(bounds, hit)) {
      return;
    }

    hit.divideScalar(SPACING).clampScalar(-half, half);

    const key = `${Math.round(hit.x)},${Math.round(hit.y)},${Math.round(hit.z)}`;
    const now = performance.now();

    if (hover && (key === lastCell || now - lastHover < HOVER_MS)) {
      return;
    }

    lastCell = key;
    lastHover = now;
    ripples[next]!.set(hit.x, hit.y, hit.z, now / 1000);
    next = (next + 1) % RIPPLES;
  };

  const onHover = (event: PointerEvent) => {
    if (event.pointerType === "mouse") {
      rippleAt(event, true);
    }
  };

  const onPress = (event: PointerEvent) => rippleAt(event, false);

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

  // Compile the shaders off the main thread where the browser can (KHR_parallel_shader_compile)
  // before the first frame, so the first draw doesn't stall the page; the poster shows meanwhile.
  await renderer.compileAsync(scene, camera);

  window.addEventListener("pointermove", onPointer, { passive: true });
  renderer.domElement.addEventListener("pointermove", onHover, { passive: true });
  renderer.domElement.addEventListener("pointerdown", onPress, { passive: true });
  resize.observe(host);
  visible.observe(host);
  frame(performance.now());
  // Next frame, so the canvas's fade-in has a start to run from.
  requestAnimationFrame(() => host.classList.add("is-live"));

  return {
    setTheme: (mode) => hud.setTheme(mode),
    dispose: () => {
      window.removeEventListener("pointermove", onPointer);
      renderer.domElement.removeEventListener("pointermove", onHover);
      renderer.domElement.removeEventListener("pointerdown", onPress);
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
