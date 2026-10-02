/**
 * One entry per published package: the landing page's cards, each page's head, the header's
 * library menu and the install card all read from here. Versions come from the packages'
 * `package.json`, so a release's redeploy shows the new one.
 */
import audit from "../../../packages/three-audit/package.json";
import batch from "../../../packages/three-batch/package.json";
import cameras from "../../../packages/three-cameras/package.json";
import meter from "../../../packages/three-meter/package.json";
import textures from "../../../packages/three-textures/package.json";

type LibraryName =
  | "three-meter"
  | "three-textures"
  | "three-cameras"
  | "three-audit"
  | "three-batch";

type Library = {
  name: LibraryName;
  version: string;
  /** `<title>`, og and twitter title. */
  title: string;
  /** Meta description: 155 characters at most, so results show it whole. */
  description: string;
  /** The /docs/ page's meta description, when the library has a demo (its page is the demo). */
  docsDescription?: string;
  /** og and twitter description: shorter. */
  shareDescription: string;
  /** What it's for, in a few words: the landing card's lead. */
  job: string;
  /** What it does, under the lead on the landing card. */
  summary: string;
  /** Installed with `-d`: a dev tool rather than something the app ships. */
  dev: boolean;
  /** Has a live demo at its page; otherwise the page is its README. */
  demo: boolean;
  /** The few lines that wire it up, for the landing page's code card. From the README. */
  snippet: string;
};

const LIBRARIES: readonly Library[] = [
  {
    name: "three-meter",
    version: meter.version,
    title: "three-meter · FPS, CPU, GPU and draw-call HUD for three.js",
    description:
      "FPS counter and performance HUD for three.js: CPU and GPU time, draw calls and triangles, live. WebGL and WebGPU, vanilla or React Three Fiber. Live demo.",
    docsDescription:
      "three-meter docs: vanilla and React Three Fiber setup, reading the HUD, stutter, budgets, top costs and GPU timing for profiling three.js scenes.",
    shareDescription:
      "Zero-dependency frame metrics for three.js with a dockable HUD. WebGL and WebGPU, vanilla or React Three Fiber.",
    job: "See what every frame costs",
    summary:
      "FPS, CPU and GPU time, stutter, draw calls and triangles, live in a HUD you dock anywhere. Budgets flag what's over. WebGL and WebGPU.",
    dev: true,
    demo: true,
    snippet: `import { PerformanceMonitor, wrapAnimationLoop } from "@zkmake/three-meter";
import { mountPerfHud } from "@zkmake/three-meter/ui";

const monitor = new PerformanceMonitor({ renderer });
mountPerfHud(monitor);
renderer.setAnimationLoop(wrapAnimationLoop(monitor, render));`,
  },
  {
    name: "three-textures",
    version: textures.version,
    title: "three-textures · see, paint and swap three.js textures live",
    description:
      "Inspect three.js textures live: preview, download, paint and swap them back into the running scene, A/B the original. KTX2 too. Vanilla or R3F. Live demo.",
    docsDescription:
      "three-textures docs: vanilla and React Three Fiber setup, what each row does, how a swap works and the panel's options, for editing three.js textures live.",
    shareDescription:
      "See, download, paint and swap three.js textures live, KTX2 included. Vanilla or React Three Fiber.",
    job: "Edit textures in the running scene",
    summary:
      "Download any texture the scene draws with, paint over it, drop it back in and see it lit, with no rebuild. A/B against the original, live-link a file. KTX2 too.",
    dev: true,
    demo: true,
    snippet: `import { mountTexturePanel } from "@zkmake/three-textures/ui";

const panel = mountTexturePanel({ scene, renderer });
// later: panel.dispose()`,
  },
  {
    name: "three-cameras",
    version: cameras.version,
    title: "three-cameras · see every camera in a three.js scene, live",
    description:
      "See every camera in a three.js scene: which are drawing and how often, position and projection live, frustum helpers. Vanilla or R3F. Live demo.",
    docsDescription:
      "three-cameras docs: vanilla and R3F setup, what each row shows, controlling a camera, the timeline and motion paths, for every camera in a three.js scene.",
    shareDescription:
      "Every camera in a three.js scene, which are drawing, their settings live, and frustum helpers. Vanilla or React Three Fiber.",
    job: "See every camera, and which are drawing",
    summary:
      "Lists the scene's cameras and the one the renderer draws with, marks the live ones with their frame rate, reads position and projection live, and draws frustums.",
    dev: true,
    demo: true,
    snippet: `import { mountCameraPanel } from "@zkmake/three-cameras/ui";

const panel = mountCameraPanel({ scene, renderer });
// later: panel.dispose()`,
  },
  {
    name: "three-audit",
    version: audit.version,
    title: "three-audit · z-fighting, NaN geometry and draw-call checks for three.js",
    description:
      "Catch z-fighting, NaN normals, black frames and draw-call blowups in three.js scenes. Assert in unit tests, run in the console or on glTF files in CI.",
    shareDescription:
      "z-fighting, NaN geometry, triangle and draw-call checks for three.js. In tests, the console, or the CLI.",
    job: "Catch broken geometry before it ships",
    summary:
      "Find z-fighting, NaN normals, black frames and triangle or draw-call blowups. Assert on them in unit tests, run them in the console, or check glTF files in CI.",
    dev: true,
    demo: false,
    snippet: `import { findBadGeometry, findZFighting } from "@zkmake/three-audit";

test("windmill has no z-fighting and no NaN geometry", () => {
  expect(findZFighting(windmill)).toEqual([]);
  expect(findBadGeometry(windmill)).toEqual([]);
});`,
  },
  {
    name: "three-batch",
    version: batch.version,
    title: "three-batch · fewer draw calls and triangles for three.js",
    description:
      "Fewer draw calls and triangles for three.js: culling cells, bakes, batches that follow moving objects, instance pools and far copies. Vanilla or R3F.",
    shareDescription:
      "Culling cells, bakes, follow batches, instance pools and far copies for three.js. Vanilla or R3F.",
    job: "Draw less, render faster",
    summary:
      "Cut draw calls and triangles: culling cells for world-spanning meshes, static bakes, batches that follow moving objects, instance pools, far copies.",
    dev: false,
    demo: false,
    snippet: `import { bake, chunkInstances } from "@zkmake/three-batch";

// dozens of meshes, one draw per material
const undo = bake(station);
// culling cells for a field that spans the world
scene.add(chunkInstances(grass, { size: 128 }));`,
  },
];

const library = (name: LibraryName): Library => LIBRARIES.find((entry) => entry.name === name)!;

/** In tab order; bun is the default. */
const installCommands = ({ name, dev }: Library) => ({
  bun: `bun add ${dev ? "-d " : ""}@zkmake/${name}`,
  npm: `npm i ${dev ? "-D " : ""}@zkmake/${name}`,
  yarn: `yarn add ${dev ? "-D " : ""}@zkmake/${name}`,
  pnpm: `pnpm add ${dev ? "-D " : ""}@zkmake/${name}`,
});

const REPO_URL = "https://github.com/zkmake/three-kit";

export { installCommands, LIBRARIES, library, REPO_URL };
export type { Library, LibraryName };
