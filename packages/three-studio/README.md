# @zkmake/three-studio

A dev page for looking at one part of a three.js scene at a time: a mockups page that puts every
variant of a look side by side, or a model studio that mounts one object in the game's own light. The
URL picks the area, the variant and the camera view, so every link is a reproducible shot. Orbit
controls, a draw-call readout, wireframe, frozen animation time and
[three-audit](../three-audit)'s console helpers come with it, and `saveShot(path)` writes the canvas to
disk for an agent or a script. A small CLI receives those shots and diffs them. Vanilla three and
React Three Fiber.

```sh
bun add -d @zkmake/three-studio   # or npm i -D / pnpm add -D
```

Give the page its own HTML entry beside `index.html` (`studio.html`, `mockups.html`). Vite serves
every HTML file in dev but builds only `index.html`, so the page never ships.

## The config

Areas hold variants; views are camera poses. Views on the config apply everywhere, an area's views
add to them, and a variant's own views (a camera variant's poses) add to those.

```ts
import { orbitViews, type StudioConfig } from "@zkmake/three-studio";

const config: StudioConfig = {
  // play: the game camera's exact offset and lens. Copy it from the game's camera code.
  views: orbitViews([0, 1, 0], 4, { play: { offset: [0, 3, 8], fov: 30 } }),
  areas: {
    trees: { title: "Trees", variants: { now: { label: "Now" }, lush: { label: "Lush" } } },
    kart: { variants: { stock: {}, livery: {} } },
  },
};
```

`orbitViews(centre, near, { play })` gives `play` (when `play` is passed), `close` (along the play
bearing), `front`, `side`, `back` and `top`, all but `play` with a 40° lens (`fov` changes it).
`front` looks from +x; for an object facing another way, pass where its front camera stands,
`{ front: [0, 0.25, -1] }` for a vehicle driving down -z, and `side` and `back` turn with it. Write
your own as `{ position, target, fov?, near?, far?, zoom? }`. A link without `view=` opens `play`
(else the first view); `defaultView` on the config names another.

## With React Three Fiber

`<Studio>` is the whole page: a canvas filling its parent. Each variant renders its part; `stage` is
what every variant stands in. Pass the game's `<Canvas>` settings so variants look as they will in
the game. Its variants are `StudioReactVariant`s, so a shared config is a
`StudioConfig<StudioReactVariant>`.

```tsx
import { Studio, type StudioReactVariant } from "@zkmake/three-studio/react";
import { createRoot } from "react-dom/client";

const TREES: Record<string, StudioReactVariant> = {
  now: { label: "Now", render: () => <Trees kind="now" /> },
  lush: { label: "Lush", render: () => <Trees kind="lush" /> },
};

createRoot(document.getElementById("root")!).render(
  <Studio
    config={{ views, areas: { trees: { variants: TREES } } }}
    canvas={{ flat: true, shadows: true, dpr: [1, 2] }}
    stage={() => <GameLights />}
  />,
);
```

The variant mounts inside a group tagged `userData.studioObject = "<area>-<variant>"`, so three-audit's
`zfight()` and `summary("trees-lush")` look at it alone. Inside a variant, `useStudio()` reads the page
state and `useStudioTime()` maps the clock to the frozen time under `?t=`:

```tsx
const time = useStudioTime();

useFrame(({ clock }) => {
  sail.current.rotation.z = time(clock.elapsedTime);
});
```

| Prop                           | Does                                                              |
| ------------------------------ | ----------------------------------------------------------------- |
| `config`                       | Areas, variants, views                                            |
| `canvas`                       | `<Canvas>` props, or a function of the state (per-area fog)       |
| `stage`                        | `(state) => ReactNode`: lights, ground, background                |
| `Canvas`                       | The `<Canvas>` component to mount. Default `@react-three/fiber`'s |
| `search`                       | The query to read. Default `location.search`                      |
| `onReady`                      | `(studio) => void`, with `mountStudio`'s handle                   |
| `className`, `style`           | On the wrapper                                                    |
| `controls`, `audit`, `overlay` | As `mountStudio`'s, below                                         |
| `globals`, `shotEndpoint`      | As `mountStudio`'s, below                                         |

`canvas.gl` is merged over `{ preserveDrawingBuffer: true }` and `canvas.camera` over the view's
lens, when they're plain objects.

A variant's `hud: (state) => ReactNode` draws DOM over the canvas (a HUD mockup); `saveShot` leaves
it out, as it does the overlay.

On React Three Fiber 10, whose default `Canvas` is WebGPU, a game drawn with WebGL (GLSL material
patches) passes `Canvas={Canvas}` from `@react-three/fiber/legacy`.

Building the `<Canvas>` yourself? Put `<StudioRig state={state} />` inside it for the same wiring,
with `state` from `resolveStudio(config, location.search)` made once (module scope or `useMemo`):
a new state remounts the rig. It takes the same rig props and `onReady`.

## Vanilla three

```ts
import { resolveStudio } from "@zkmake/three-studio";
import { mountStudio } from "@zkmake/three-studio/ui";

const state = resolveStudio(config, location.search);
const group = buildVariant(state.areaName, state.variantName);

group.userData.studioObject = state.tag;
scene.add(group);

const studio = mountStudio({ state, renderer, scene, camera });

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  studio.update(); // the readout, and wireframe on meshes added since
});
```

`mountStudio` puts the camera at the view, adds OrbitControls, the overlay and the console helpers.
Turn any of them off with `controls: false`, `overlay: false`, `audit: false`, `globals: false`, or
pass options through: `audit` takes three-audit's `installAuditHelpers` options (it passes the
`renderer` itself), `overlay` a `container`. With post-processing, pass
`render: () => composer.render()` so shots include it. `shotEndpoint` sets where shots post, over
`?shots=`.

The handle has `state`, `camera`, `controls`, `overlay`, `setView(name)`, `saveShot(path)`,
`stats()`, `update()` and `dispose()`.

## The URL

| Parameter      | Does                                                                |
| -------------- | ------------------------------------------------------------------- |
| `area=<name>`  | The area. A bare `?<name>` works too, as single-object studios link |
| `v=<name>`     | The variant; the area's first by default                            |
| `view=<name>`  | The camera view; `play` (or `defaultView`) by default               |
| `t=<seconds>`  | Freezes animation at that time, for steady shots (`useStudioTime`)  |
| `wire=1`       | Draws every material as wireframe, to read the topology             |
| `clean=1`      | Hides the overlay, for screenshots of the whole window              |
| `shots=<port>` | Where `saveShot` posts, when `three-studio serve` isn't on 8787     |

Unknown names fall back to the defaults and are listed in `state.unknown`. `studioHref(state, change)`
builds links: a new area starts at its first variant; the view, `wire`, `t` and `shots` carry over,
`clean` only when asked for.

The overlay puts areas and variants top left with the readout (`12 calls · 34,567 tris`) under them,
and views top right. View chips move the camera in place and update the URL; area and variant chips
load their link, so each variant mounts fresh.

## Screenshots, for agents

Start the receiver on a folder, then save shots from the page:

```sh
npx @zkmake/three-studio serve shots/   # listens on 127.0.0.1:8787
```

```js
await saveShot("round-1/trees-lush-play.png");
// "/…/shots/round-1/trees-lush-play.png  38 calls · 112,400 tris"
```

That `saveShot` is the page's, on `window` (`mountStudio` and `<Studio>` put it there): it draws
through the page's `render`, adds the readout and posts to the `?shots=` port. Paths are relative to
the receiver's folder, or absolute inside it.

Port 8787 taken (another receiver, another agent's pass)? `serve` says so: run it with
`--port 8797` and open the page with `&shots=8797`, which links on the page carry along.

`saveShot` draws a frame and reads it in the same task, so it needs no `preserveDrawingBuffer` and
works in a hidden browser pane where `requestAnimationFrame` never fires. The receiver only writes
`.png` files inside its folder, and only listens locally. `{ size: "css" }` saves at the canvas's CSS
size instead of its pixels.

`window.studio` has the rest: `studio.setView("close")`, `studio.views`, `studio.stats()`,
`studio.state`, `studio.scene`, `studio.camera`, `studio.renderer`, `studio.saveShot`, and
`studio.installFrameShim()`, which keeps animations running in a hidden pane (frame rates from it
mean nothing; draws and triangles still hold).

Without a mounted studio, `saveShot(path, options)` from `@zkmake/three-studio` takes the pieces
itself: `canvas` (default the first on the page), `render`, `size`, `endpoint` (default
`http://127.0.0.1:8787`, `SHOT_PORT`) and `stats`. `canvasPng(canvas, { render, size })` is the
PNG alone.

## Comparing shots

```sh
npx @zkmake/three-studio diff before.png after.png --max 0.1 --out mask.png
# 412 px differ (0.0134%)
npx @zkmake/three-studio montage compare.png before-play.png after-play.png before-close.png after-close.png
```

`diff` counts the pixels whose largest channel moved more than `--fuzz` (3% by default) and exits 1
when more than `--max` percent differ, so a stored baseline can gate CI. `--out` writes those pixels
in white over a dimmed copy of the first image; `--json` prints `{ pixels, total, share, over }`.
Both images must be the same size. `montage` lays out before/after pairs side by side, rows
stacked, at half size (`--scale`, default 0.5; `--gap`, default 8 px before scaling). Bad arguments
or an unreadable file exit 2.

From a script, `@zkmake/three-studio/node` has the same pieces: `startShotServer`, `decodePng`,
`encodePng`, `diffImages`, `montage`, `scaleImage`. PNGs only, 8-bit, not interlaced: what canvases
and browsers save. `startShotServer(folder, { port, host, log })` takes port 0 for a free one, and
its `url` is what `saveShot`'s `endpoint` takes.

## The rest

The core (`@zkmake/three-studio`, no DOM at import) also exports what the page is built from:
`applyView(camera, view, controls?)`, `setWireframe(root, on)`, `studioTime(state, elapsed)`,
`titleOf`, `installFrameShim()`, and the readout's `frameStats(renderer)` and `formatStats`. `/ui`
exports `mountStudioOverlay({ state, container?, onView? })`, the switchers and readout alone, and
`injectStyles` / `STUDIO_STYLES`.

## License

MIT
