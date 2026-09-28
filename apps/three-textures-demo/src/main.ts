/**
 * A scene with one of each kind of texture the panel handles: an image loaded from a file and a
 * clone of it (same pixels, own repeat), a data texture, and a KTX2 compressed texture when
 * `public/local/atlas.ktx2` exists (a local test asset, never committed).
 */
import { PerformanceMonitor, wrapAnimationLoop } from "@zkmake/three-meter";
import { mountPerfHud } from "@zkmake/three-meter/ui";
import type { TextureLab } from "@zkmake/three-textures";
import { mountTexturePanel } from "@zkmake/three-textures/ui";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);

camera.position.set(0, 2.2, 7);
scene.background = new THREE.Color("#1b1f26");
scene.add(new THREE.HemisphereLight("#ffffff", "#445", 2.2));

const controls = new OrbitControls(camera, renderer.domElement);

/** A labelled checker, as a PNG file URL, so the texture has a source file to download. */
const checkerUrl = () => {
  const canvas = document.createElement("canvas");

  canvas.width = canvas.height = 256;

  const context = canvas.getContext("2d")!;

  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      context.fillStyle = (x + y) % 2 ? "#e9d8a6" : "#94d2bd";
      context.fillRect(x * 32, y * 32, 32, 32);
    }
  }

  context.fillStyle = "#001219";
  context.font = "bold 44px sans-serif";
  context.fillText("TOP", 88, 52);

  return canvas.toDataURL("image/png");
};

const checker = await new THREE.TextureLoader().loadAsync(checkerUrl());

checker.name = "checker";
checker.colorSpace = THREE.SRGBColorSpace;

const tiled = checker.clone();

tiled.wrapS = tiled.wrapT = THREE.RepeatWrapping;
tiled.repeat.set(2, 2);

const noiseData = new Uint8Array(64 * 64 * 4);

for (let i = 0; i < noiseData.length; i += 4) {
  const v = Math.random() * 255;

  noiseData.set([v, v * 0.6, 255 - v, 255], i);
}

const noise = new THREE.DataTexture(noiseData, 64, 64);

noise.name = "noise";
noise.needsUpdate = true;

const box = (map: THREE.Texture, x: number) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshStandardMaterial({ map }),
  );

  mesh.position.x = x;
  scene.add(mesh);

  return mesh;
};

box(checker, -2.4);
box(tiled, -0.8);
box(noise, 0.8);

const ktx2 = await fetch("/local/atlas.ktx2", { method: "HEAD" }).then((response) => response.ok);

if (ktx2) {
  const loader = new KTX2Loader()
    .setTranscoderPath("/node_modules/three/examples/jsm/libs/basis/")
    .detectSupport(renderer);
  const atlas = await loader.loadAsync("/local/atlas.ktx2");

  atlas.name = "atlas (ktx2)";
  atlas.colorSpace = THREE.SRGBColorSpace;

  // KTX2 (like glTF) stores the image top row first and can't be flipped on upload, while a
  // plane's uvs expect a `flipY` image: turn its v over so the atlas reads the right way up.
  const geometry = new THREE.PlaneGeometry(1.6, 1.6);
  const uv = geometry.attributes.uv!;

  for (let i = 0; i < uv.count; i += 1) {
    uv.setY(i, 1 - uv.getY(i));
  }

  const plane = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ map: atlas, transparent: true, side: THREE.DoubleSide }),
  );

  plane.position.x = 2.5;
  scene.add(plane);
}

const panel = mountTexturePanel({
  scene,
  renderer,
  storageKey: "three-textures-demo",
  // oxlint-disable-next-line no-console -- the demo logs swaps
  onSwap: (event) => console.info("[demo] swap", event.id, event.state),
});

Object.assign(window, { demo: { scene, renderer, lab: panel.lab as TextureLab, panel } });

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// three-meter's HUD on the left: the two panels share one frame, so they dock, dim and toggle alike.
const monitor = new PerformanceMonitor({ renderer });

mountPerfHud(monitor, {
  storageKey: "three-textures-demo:meter",
  defaultPlacement: { edge: "left", align: "start" },
});

renderer.setAnimationLoop(
  wrapAnimationLoop(monitor, () => {
    controls.update();
    renderer.render(scene, camera);
  }),
);
