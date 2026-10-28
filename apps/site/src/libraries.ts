/**
 * One entry per published package: the landing page's cards, each page's head, the header's
 * library menu and the install card all read from here. Versions come from the packages'
 * `package.json`, so a release's redeploy shows the new one.
 */
import audit from "../../../packages/three-audit/package.json";
import batch from "../../../packages/three-batch/package.json";
import cameras from "../../../packages/three-cameras/package.json";
import devtools from "../../../packages/three-devtools/package.json";
import meter from "../../../packages/three-meter/package.json";
import quality from "../../../packages/three-quality/package.json";
import studio from "../../../packages/three-studio/package.json";
import textures from "../../../packages/three-textures/package.json";

type LibraryName =
  | "three-meter"
  | "three-textures"
  | "three-cameras"
  | "three-audit"
  | "three-studio"
  | "three-batch"
  | "three-quality"
  | "three-devtools";

type Library = {
  name: LibraryName;
  version: string;
  /** Its page's (the README's) `<title>`, og and twitter title: 60 characters at most. */
  title: string;
  /** Meta description: 155 characters at most, so results show it whole. */
  description: string;
  /** The /demo/ page's `<title>`, when the library has a demo: 60 characters at most. */
  demoTitle?: string;
  /** The /demo/ page's meta description, when the library has a demo. */
  demoDescription?: string;
  /** og and twitter description: shorter. */
  shareDescription: string;
  /** What it's for, in a few words: the landing card's lead. */
  job: string;
  /** What it does, under the lead on the landing card. */
  summary: string;
  /** The chip on the landing card's clip or drawing: what the package adds to a scene. */
  mediaLabel: string;
  /** Installed with `-d`: a dev tool rather than something the app ships. */
  dev: boolean;
  /** Has a live demo at `/<name>/demo/`, beside its README at `/<name>/`. */
  demo: boolean;
  /**
   * The few lines that wire it up, for the landing page's code card. From the README, in lines of
   * 44 characters or fewer, so a 390px phone shows each line whole.
   */
  snippet: string;
  /** The same with its React Three Fiber components, when it has them. */
  r3fSnippet?: string;
};

const LIBRARIES: readonly Library[] = [
  {
    name: "three-meter",
    version: meter.version,
    title: "three-meter · FPS, CPU, GPU and draw-call HUD for three.js",
    description:
      "three-meter, an FPS and GPU time HUD for three.js: vanilla and React Three Fiber setup, reading the HUD, stutter, budgets, top costs. With a live demo.",
    demoTitle: "three-meter live demo · FPS and GPU time HUD for three.js",
    demoDescription:
      "FPS counter and performance HUD for three.js: CPU and GPU time, draw calls and triangles, live. WebGL and WebGPU, vanilla or React Three Fiber. Live demo.",
    shareDescription:
      "Zero-dependency frame metrics for three.js with a dockable HUD. WebGL and WebGPU, vanilla or React Three Fiber.",
    job: "See what every frame costs",
    summary:
      "FPS, CPU and GPU time, stutter, draw calls and triangles, live in a HUD you dock anywhere. Budgets flag what's over. WebGL and WebGPU.",
    mediaLabel: "FPS · CPU · GPU · draw calls",
    dev: true,
    demo: true,
    snippet: `import {
  PerformanceMonitor, wrapAnimationLoop,
} from "@zkmake/three-meter";
import { mountPerfHud }
  from "@zkmake/three-meter/ui";

const monitor =
  new PerformanceMonitor({ renderer });
mountPerfHud(monitor);
renderer.setAnimationLoop(
  wrapAnimationLoop(monitor, render),
);`,
    r3fSnippet: `import { PerfHud, PerfSampler }
  from "@zkmake/three-meter/react";

<>
  <Canvas>
    <PerfSampler />
    {/* scene */}
  </Canvas>
  <PerfHud />
</>;`,
  },
  {
    name: "three-textures",
    version: textures.version,
    title: "three-textures · see, paint and swap three.js textures live",
    description:
      "three-textures, to edit three.js textures live: vanilla and React Three Fiber setup, what each row does, how a swap works, the options. With a live demo.",
    demoTitle: "three-textures live demo · paint and swap three.js textures",
    demoDescription:
      "Inspect three.js textures live: preview, download, paint and swap them back into the running scene, A/B the original. KTX2 too. Vanilla or R3F. Live demo.",
    shareDescription:
      "See, download, paint and swap three.js textures live, KTX2 included. Vanilla or React Three Fiber.",
    job: "Edit textures in the running scene",
    summary:
      "Download any texture the scene draws with, paint over it, drop it back in and see it lit, with no rebuild. A/B against the original, live-link a file. KTX2 too.",
    mediaLabel: "paint and swap textures",
    dev: true,
    demo: true,
    snippet: `import { mountTexturePanel }
  from "@zkmake/three-textures/ui";

const panel =
  mountTexturePanel({ scene, renderer });
// later: panel.dispose()`,
    r3fSnippet: `import { TexturePanel }
  from "@zkmake/three-textures/react";

<Canvas>
  {import.meta.env.DEV && <TexturePanel />}
  {/* … */}
</Canvas>;`,
  },
  {
    name: "three-cameras",
    version: cameras.version,
    title: "three-cameras · see every camera in a three.js scene, live",
    description:
      "three-cameras, every camera in a three.js scene: vanilla and R3F setup, what each row shows, controlling a camera, the timeline, motion paths. Live demo.",
    demoTitle: "three-cameras live demo · every camera in a three.js scene",
    demoDescription:
      "See every camera in a three.js scene: which are drawing and how often, position and projection live, frustum helpers. Vanilla or R3F. Live demo.",
    shareDescription:
      "Every camera in a three.js scene, which are drawing, their settings live, and frustum helpers. Vanilla or React Three Fiber.",
    job: "See every camera, and which are drawing",
    summary:
      "Lists the scene's cameras and the one the renderer draws with, marks the live ones with their frame rate, reads position and projection live, and draws frustums.",
    mediaLabel: "every camera, live",
    dev: true,
    demo: true,
    snippet: `import { mountCameraPanel }
  from "@zkmake/three-cameras/ui";

const panel =
  mountCameraPanel({ scene, renderer });
// later: panel.dispose()`,
    r3fSnippet: `import { CameraPanel }
  from "@zkmake/three-cameras/react";

<Canvas>
  <CameraPanel />
  {/* … */}
</Canvas>;`,
  },
  {
    name: "three-audit",
    version: audit.version,
    title: "three-audit · z-fighting and NaN checks for three.js",
    description:
      "Catch z-fighting, NaN normals, black frames and draw-call blowups in three.js scenes. Assert in unit tests, run in the console or on glTF files in CI.",
    shareDescription:
      "z-fighting, NaN geometry, triangle and draw-call checks for three.js. In tests, the console, or the CLI.",
    job: "Catch broken geometry before it ships",
    summary:
      "Find z-fighting, NaN normals, black frames and triangle or draw-call blowups. Assert on them in unit tests with Vitest matchers, run them in the console, or check glTF files in CI, all against one budgets file per app.",
    mediaLabel: "z-fighting and NaN checks",
    dev: true,
    demo: false,
    snippet: `import { findBadGeometry, findZFighting }
  from "@zkmake/three-audit";

test("no z-fighting or NaNs", () => {
  expect(findZFighting(mill)).toEqual([]);
  expect(findBadGeometry(mill)).toEqual([]);
});`,
  },
  {
    name: "three-studio",
    version: studio.version,
    title: "three-studio · mockup and model studio pages for three.js",
    description:
      "A dev page for three.js: areas, variants and camera views from the URL, a draw-call readout and screenshots agents can take and diff. Vanilla or R3F.",
    shareDescription:
      "Mockup and model studio pages for three.js, with URL-driven views, a draw-call readout and screenshots to diff. Vanilla or R3F.",
    job: "Look at one part at a time",
    summary:
      "A mockups or model-studio page from a config: areas, variants and camera views in the URL, orbit controls, a draw-call readout, and shots saved to disk and diffed.",
    mediaLabel: "areas · variants · views",
    dev: true,
    demo: false,
    snippet: `import { Studio }
  from "@zkmake/three-studio/react";

<Studio
  config={{ views, areas: {
    trees: { variants: TREES },
  } }}
  stage={() => <GameLights />}
/>;`,
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
    mediaLabel: "64 meshes → 4 draws",
    dev: false,
    demo: false,
    snippet: `import { bake, chunkInstances }
  from "@zkmake/three-batch";

// dozens of meshes, one draw per material
const undo = bake(station);
// culling cells for a world-wide field
scene.add(
  chunkInstances(grass, { size: 128 }),
);`,
    r3fSnippet: `import { Baked }
  from "@zkmake/three-batch/react";

// dozens of meshes, one draw per material
<Baked name="station">
  <mesh geometry={wall} material={brick} />
  <mesh geometry={roof} material={slate} />
</Baked>;`,
  },
  {
    name: "three-quality",
    version: quality.version,
    title: "three-quality · adaptive render quality for three.js",
    description:
      "Adaptive render quality for three.js: steps the pixel ratio and your quality tiers to what the device keeps up with, remembered per device. Vanilla or R3F.",
    shareDescription:
      "Runtime adaptive quality for three.js: pixel ratio and quality tiers stepped from frame times, remembered per device. Vanilla or R3F.",
    job: "Hold the frame rate on any device",
    summary:
      "Steps the pixel ratio down when frames run slow and back up when there's room, then your own tiers (shadows, bloom). Checks each step paid, remembers the device. WebGL and WebGPU.",
    mediaLabel: "dpr 1.5 → 1.25 → 1",
    dev: false,
    demo: false,
    snippet: `import { adaptQuality }
  from "@zkmake/three-quality";

// pixel ratio, then shadows, until
// the frame rate holds
const quality = adaptQuality(renderer, {
  tiers: [{ name: "shadows", set }],
});`,
    r3fSnippet: `import { AdaptiveQuality }
  from "@zkmake/three-quality/react";

<Canvas dpr={1}>
  <AdaptiveQuality tiers={["shadows"]} />
  {/* … */}
</Canvas>;`,
  },
  {
    name: "three-devtools",
    version: devtools.version,
    title: "three-devtools · a three.js app's dev tools behind ?debug",
    description:
      "One drop-in for a three.js app's ?debug: the three-meter HUD with your budgets and quality, three-audit's console helpers, camera and texture panels. Lazy.",
    shareDescription:
      "A three.js app's dev tools behind ?debug in one drop-in, loaded lazily so a normal load pays nothing. Vanilla or React Three Fiber.",
    job: "Every dev tool behind ?debug",
    summary:
      "One call or component mounts the HUD with the app's budgets and adaptive quality, the console helpers, and the panels it asks for. All lazy: a normal load pays nothing.",
    mediaLabel: "?debug",
    dev: false,
    demo: false,
    snippet: `import { mountDevTools }
  from "@zkmake/three-devtools";

// ?debug: HUD, console helpers, panels
const tools = mountDevTools({
  renderer, scene, budgets,
});
renderer.setAnimationLoop(
  tools.wrap(render),
);`,
    r3fSnippet: `import { DevTools }
  from "@zkmake/three-devtools/react";

<Canvas>
  {/* scene */}
  <DevTools budgets={budgets} />
</Canvas>;`,
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
