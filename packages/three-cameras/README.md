# @zkmake/three-cameras

A dev panel for the cameras in a three.js scene. It lists every camera: the ones in the scene
graph, and the one the renderer draws with even when it isn't in the scene (R3F's default camera,
most vanilla apps' main camera). It marks which cameras are drawing right now and how often,
reads each one's position and projection live, and draws a camera's frustum in the scene.

Pick a camera and you control it: edit its position, rotation and lens by typing or scrubbing, look
through it in place of the app's main view, copy its setup as code, and save views to fly back to.
Keyframed camera moves with curve and graph editors are next.

```sh
bun add -d @zkmake/three-cameras   # or npm i -D / yarn add -D / pnpm add -D
```

Live demo: [three-kit.pages.dev/three-cameras](https://three-kit.pages.dev/three-cameras/), with a
vanilla three and a React Three Fiber take on the same set: an orbit view, a dolly camera circling
the set and drawing a picture-in-picture inset, an overhead orthographic camera and a security
camera.

## Vanilla three

```ts
import { mountCameraPanel } from "@zkmake/three-cameras/ui";

const panel = mountCameraPanel({ scene, renderer });
// later: panel.dispose()
```

## React Three Fiber

```tsx
import { CameraPanel } from "@zkmake/three-cameras/react";

<Canvas>
  <CameraPanel />
</Canvas>;
```

It reads the scene and renderer from the canvas, so the canvas's camera shows as live, and asks for
a frame after a frustum toggles, so `frameloop="demand"` works.

## What each row shows

| Part          | What it is                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------- |
| icon          | The kind: perspective, orthographic, array or cube. Green while the camera draws.             |
| live · 60 fps | It drew a frame in the last half second, and how many in the last second                      |
| second line   | fov, near–far and aspect (perspective), or zoom and near–far (orthographic); "not in scene"   |
| look through  | Show the main view through it (see below)                                                     |
| frustum       | Draw its view volume in the scene. It follows the camera, and hides while you look through it |

Rows are named by the `cameras` option, else the camera's `name`, else its kind (`perspective camera
2`). Name your cameras and the panel reads better.

## Controlling a camera

Pick a row (click its name) and it opens into the camera's controls:

- **Position and rotation**, its own (relative to its parent), rotation in degrees, and **lens**: fov,
  near, far and zoom. Type a value, or drag a field's label to scrub it: Shift for fine steps, Alt
  for coarse. An app that sets the camera every frame wins on its next frame.
- **Copy as code**: three.js that sets the camera up as it is now, named after the camera.
- **Save view**: keeps where it is and how it projects. Click a saved view to fly back to it (eased
  over 0.8 s); the docked panel keeps them in localStorage, by camera name.
- A readout of what isn't edited here: world position, aspect, frame rate, where it sits.

**Look through** swaps a camera into the app's main view: the view drawing the most of the screen,
so a picture-in-picture inset or a render target keeps its own camera. The camera is fitted to that
view's aspect for the frame and put back after, and the app's camera is left where it was. A banner
shows what you're looking through, with a way back.

## How it finds cameras

- **The scene graph:** anything with `isCamera` under `scene`. A `CubeCamera` is one row; its six face
  cameras aren't listed.
- **The renderer:** the lab wraps `renderer.render` on the instance and notes every camera it's
  handed. A camera the scene doesn't hold gets a row on its first frame and stays while it keeps
  drawing (a few seconds after it stops). Post-processing that calls `renderer.render` counts too.

`dispose()` puts `render` back, unless something wrapped it after the panel did, in which case the
panel's wrapper stays in place and just passes through.

## Options

| Option             | Default                             | What it does                                                                      |
| ------------------ | ----------------------------------- | --------------------------------------------------------------------------------- |
| `scene`            | required                            | Where to look for cameras, and where frustum helpers go                           |
| `renderer`         | none                                | Watched for the cameras it draws with; without it nothing is "live"               |
| `cameras`          | `[]`                                | `{ name, camera }` to list whether or not the scene holds them yet                |
| `invalidate`       | none                                | Ask for frames after an edit, a toggle, or during a move (render-on-demand loops) |
| `store`            | localStorage, by `storageKey`       | Where saved views live: `{ load(), save(views) }`                                 |
| `storageKey`       | `"three-cameras"`                   | localStorage prefix for the dock and compact state; `null` for none               |
| `defaultPlacement` | `{ edge: "right", align: "start" }` | Where it docks on a first visit                                                   |
| `theme`            | `"system"`                          | `"dark"`, `"light"` or `"system"`                                                 |
| `compact`          | `false`                             | Start compact, showing the brand row and the count                                |
| `container`        | `document.body`                     | Where to mount                                                                    |

## The engine

`CameraLab` is the panel's engine, with no DOM, for scripting or a panel of your own:

```ts
import { CameraLab } from "@zkmake/three-cameras";
import { createCameraPanel } from "@zkmake/three-cameras/ui";

const lab = new CameraLab({ scene, renderer });

lab.entries(); // [{ id, kind, camera, inScene, live, fps, helper, viewing, views, … }]
lab.details("dolly"); // { position, rotation, local: { position, rotation }, projection }
lab.set("dolly", { fov: 30, position: [0, 2, 8] });
lab.lookThrough("dolly"); // null to go back
lab.setHelper("dolly", true);

const home = lab.saveView("dolly", "home");
lab.goToView("dolly", home.id, { duration: 800 });

tab.append(createCameraPanel(lab).element); // the bare panel, for a host with its own tabs
```

## The dev-panel frame

It docks in three-meter's `mountDevPanel`, so it drags, snaps to an edge, compacts and dims exactly
like the three-meter HUD and the three-textures panel, with its brand label on top.

## License

MIT
