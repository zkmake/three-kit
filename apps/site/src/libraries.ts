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
  /** Meta description. */
  description: string;
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
};

const LIBRARIES: readonly Library[] = [
  {
    name: "three-meter",
    version: meter.version,
    title: "three-meter · FPS, CPU, GPU and draw-call HUD for three.js",
    description:
      "Zero-dependency frame metrics for three.js: FPS, CPU and GPU time, draw calls, triangles and resource counts in a small dockable HUD. Works with WebGLRenderer and WebGPURenderer, vanilla or React Three Fiber. Live demo.",
    shareDescription:
      "Zero-dependency frame metrics for three.js with a dockable HUD. WebGL and WebGPU, vanilla or React Three Fiber.",
    job: "See what every frame costs",
    summary:
      "FPS, CPU and GPU time, stutter, draw calls and triangles, live in a HUD you dock anywhere. Budgets flag what's over. WebGL and WebGPU.",
    dev: true,
    demo: true,
  },
  {
    name: "three-textures",
    version: textures.version,
    title: "three-textures · see, paint and swap three.js textures live",
    description:
      "A dev panel for the textures in a three.js scene: preview, download, paint and swap them back in live, A/B against the original, live-link a file so every save shows. KTX2 compressed textures too. Vanilla three or React Three Fiber. Live demo.",
    shareDescription:
      "See, download, paint and swap three.js textures live, KTX2 included. Vanilla or React Three Fiber.",
    job: "Edit textures in the running scene",
    summary:
      "Download any texture the scene draws with, paint over it, drop it back in and see it lit, with no rebuild. A/B against the original, live-link a file. KTX2 too.",
    dev: true,
    demo: true,
  },
  {
    name: "three-cameras",
    version: cameras.version,
    title: "three-cameras · see every camera in a three.js scene, live",
    description:
      "A dev panel for the cameras in a three.js scene: every camera, including the one the renderer draws with outside the scene, which are live and how often they draw, their position and projection read live, and frustum helpers. Vanilla three or React Three Fiber. Live demo.",
    shareDescription:
      "Every camera in a three.js scene, which are drawing, their settings live, and frustum helpers. Vanilla or React Three Fiber.",
    job: "See every camera, and which are drawing",
    summary:
      "Lists the scene's cameras and the one the renderer draws with, marks the live ones with their frame rate, reads position and projection live, and draws frustums.",
    dev: true,
    demo: true,
  },
  {
    name: "three-audit",
    version: audit.version,
    title: "three-audit · z-fighting, NaN geometry and draw-call checks for three.js",
    description:
      "Checks for a three.js scene: z-fighting, NaN normals, triangle counts, a cost census, black frames and a one-frame draw-call ledger. Runs in unit tests, the browser console, or on glTF files from the CLI. Zero dependencies.",
    shareDescription:
      "z-fighting, NaN geometry, triangle and draw-call checks for three.js. In tests, the console, or the CLI.",
    job: "Catch broken geometry before it ships",
    summary:
      "Find z-fighting, NaN normals, black frames and triangle or draw-call blowups. Assert on them in unit tests, run them in the console, or check glTF files in CI.",
    dev: true,
    demo: false,
  },
  {
    name: "three-batch",
    version: batch.version,
    title: "three-batch · fewer draw calls and triangles for three.js",
    description:
      "Fewer draw calls and triangles for three.js: culling cells, static bakes, batches that follow moving objects, per-frame instance pools, and far copies made with meshoptimizer. Vanilla three and React Three Fiber.",
    shareDescription:
      "Culling cells, bakes, follow batches, instance pools and far copies for three.js. Vanilla or R3F.",
    job: "Draw less, render faster",
    summary:
      "Cut draw calls and triangles: culling cells for world-spanning meshes, static bakes, batches that follow moving objects, instance pools, far copies.",
    dev: false,
    demo: false,
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
