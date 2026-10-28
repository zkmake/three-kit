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

`orbitViews(centre, near, { play })` gives `play`, `close` (along the play bearing), `front`, `side`,
`back` and `top`. Write your own as `{ position, target, fov?, near?, far?, zoom? }`.

## With React Three Fiber

`<Studio>` is the whole page. Each variant renders its part; `stage` is what every variant stands in.
Pass the game's `<Canvas>` settings so variants look as they will in the game.

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

Building the `<Canvas>` yourself? Put `<StudioRig state={resolveStudio(config, location.search)} />`
inside it for the same wiring.

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
Turn any of them off with `controls: false`, `overlay: false`, `audit: false`, `globals: false`. With
post-processing, pass `render: () => composer.render()` so shots include it.

## The URL

| Parameter     | Does                                                                |
| ------------- | ------------------------------------------------------------------- |
| `area=<name>` | The area. A bare `?<name>` works too, as single-object studios link |
| `v=<name>`    | The variant; the area's first by default                            |
| `view=<name>` | The camera view; `play` by default                                  |
| `t=<seconds>` | Freezes animation at that time, for steady shots (`useStudioTime`)  |
| `wire=1`      | Draws every material as wireframe, to read the topology             |
| `clean=1`     | Hides the overlay, for screenshots of the whole window              |

Unknown names fall back to the defaults and are listed in `state.unknown`. `studioHref(state, change)`
builds links: a new area starts at its first variant, the view and `wire` / `t` carry over.

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

`saveShot` draws a frame and reads it in the same task, so it needs no `preserveDrawingBuffer` and
works in a hidden browser pane where `requestAnimationFrame` never fires. The receiver only writes
`.png` files inside its folder, and only listens locally. `{ size: "css" }` saves at the canvas's CSS
size instead of its pixels.

`window.studio` has the rest: `studio.setView("close")`, `studio.views`, `studio.stats()`,
`studio.state`, and `studio.installFrameShim()`, which keeps animations running in a hidden pane
(frame rates from it mean nothing; draws and triangles still hold).

## Comparing shots

```sh
npx @zkmake/three-studio diff before.png after.png --max 0.1 --out mask.png
# 412 px differ (0.0134%)
npx @zkmake/three-studio montage compare.png before-play.png after-play.png before-close.png after-close.png
```

`diff` counts the pixels whose largest channel moved more than `--fuzz` (3% by default) and exits 1
when more than `--max` percent differ, so a stored baseline can gate CI. `--out` writes those pixels
in white over a dimmed copy of the first image. `montage` lays out before/after pairs side by side,
rows stacked, at half size (`--scale`, `--gap`).

From a script, `@zkmake/three-studio/node` has the same pieces: `startShotServer`, `decodePng`,
`encodePng`, `diffImages`, `montage`, `scaleImage`. PNGs only, 8-bit, not interlaced: what canvases
and browsers save.
