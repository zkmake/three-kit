# @zkmake/three-cameras

A dev panel for the cameras in a three.js scene. It lists every camera: the ones in the scene
graph, and the one the renderer draws with even when it isn't in the scene (R3F's default camera,
most vanilla apps' main camera). It marks which cameras are drawing right now and how often,
reads each one's position and projection live, and draws a camera's frustum in the scene.

Pick a camera and you control it: edit its position, rotation and lens by typing or scrubbing, look
through it in place of the app's main view, copy its setup as code, and save views to fly back to.
Animate cameras on a keyframe timeline: key a camera, retime and ease its keys, and play the move
back in the running scene, shaping them in a graph editor and an ease curve editor, with the
motion path drawn in the scene.

It's one panel, anchored across the bottom of the screen: the camera list as the timeline's left
sidebar, each camera's row beside its key lane. Collapsed, it's a small widget with the picked
camera (its kind, name, and whether it's live or looked through); click it to expand.

```sh
bun add -d @zkmake/three-cameras   # or npm i -D / yarn add -D / pnpm add -D
```

Live demo: [zkmake.github.io/three-kit/three-cameras](https://zkmake.github.io/three-kit/three-cameras/), with a
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

## The timeline

The timeline animates cameras with keyframes. Its left column is the camera list: each camera's row
sits beside its lane, and a row opened into its controls stretches its lane to match.

- **Key** the picked camera as it is now at the playhead, or double-click its lane to key it there.
  A key holds its position, rotation and lens.
- **Drag** a key to retime it (snaps to 0.1 s; Shift for free). Click one to inspect it: its time,
  its **ease** into the next key (ease in-out, linear, ease in, ease out, or hold), **Update** to
  re-key it from the camera as it is now, and **Delete**.
- **Play**, pause (Space), scrub the ruler, loop, and set the length. The camera travels a smooth
  curve through its keys, turns evenly between them, and its lens eases too.
- Once you play or scrub, tracked cameras are held to their tracks right before each frame, so a
  track wins over an app that moves the camera itself. Edit a camera and it's let go, so the edit
  sticks until you key it; **stop** lets every camera go back to the app.
- Look through a camera while it plays to see the shot. Tracks are kept in localStorage, by camera
  name. Pass `timeline: false` for the camera list alone.

### Shaping a move

- **Ease curve**: the key inspector draws the move from the picked key to the next as a curve of
  progress over time, with two handles (CSS `cubic-bezier` terms). Drag a handle to reshape it: a
  preset becomes a custom curve from the preset's shape. Handles go above 1 or below 0 for
  overshoot and anticipation.
- **Graph**: switch the timeline to Graph for the picked camera's channels over time: position x,
  y, z, rotation x, y, z (degrees), fov or zoom, near and far, drawn as the track plays them. Drag
  a key's dot up or down to change that value (Shift for fine), or sideways to retime the key. Click
  between keys to pick that segment's ease; double-click to add a key. Channels are stretched to
  their own ranges; "values" puts them on one scale.

### Motion paths in the scene

A camera that moves shows its path in the scene by itself, while it moves (cameras in the scene;
your own view camera is left out):

- **Keyed** cameras show their track, an amber curve with a white dot per key. **Drag a dot** in the
  scene to move that key: it slides on a plane facing you, Shift for straight up or down. The path
  and the move reshape as you drag, and the press doesn't reach orbit controls.
- **App-driven** cameras (moved by your code, not keys) show where they've been over the last 8
  seconds, a light blue line. Your code drives that move, so it can't be dragged; **Bake to keys**
  in the camera's controls turns it into keys (one where the path bends, linear timing), and it's a
  track to edit like any other. Played, the track takes over from the app.
- The path toggle on a camera's row shows or hides its path by hand.

## How it finds cameras

- **The scene graph:** anything with `isCamera` under `scene`. A `CubeCamera` is one row; its six face
  cameras aren't listed.
- **The renderer:** the lab wraps `renderer.render` on the instance and notes every camera it's
  handed. A camera the scene doesn't hold gets a row on its first frame and stays while it keeps
  drawing (a few seconds after it stops). Post-processing that calls `renderer.render` counts too.

`dispose()` puts `render` back, unless something wrapped it after the panel did, in which case the
panel's wrapper stays in place and just passes through.

## Options

| Option             | Default                             | What it does                                                                                     |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `scene`            | required                            | Where to look for cameras, and where frustum helpers go                                          |
| `renderer`         | none                                | Watched for the cameras it draws with; without it nothing is "live"                              |
| `cameras`          | `[]`                                | `{ name, camera }` to list whether or not the scene holds them yet                               |
| `invalidate`       | none                                | Ask for frames after an edit, a toggle, or during a move (render-on-demand loops)                |
| `store`            | localStorage, by `storageKey`       | Where saved views live: `{ load(), save(views) }`                                                |
| `trackStore`       | localStorage, by `storageKey`       | Where keyframe tracks live: `{ load(), save({ duration, tracks }) }`                             |
| `timeline`         | `true`                              | The timeline, with the camera list as its sidebar, across the bottom; `false` for the list alone |
| `storageKey`       | `"three-cameras"`                   | localStorage prefix for the dock and compact state; `null` for none                              |
| `defaultPlacement` | `{ edge: "right", align: "start" }` | Where the list alone docks on a first visit (with the timeline it spans the bottom)              |
| `theme`            | `"system"`                          | `"dark"`, `"light"` or `"system"`                                                                |
| `compact`          | `false`                             | Start compact, showing the brand row and the count                                               |
| `container`        | `document.body`                     | Where to mount                                                                                   |

## The engine

`CameraLab` is the panel's engine, with no DOM, for scripting or a panel of your own:

```ts
import { CameraLab, writeChannel } from "@zkmake/three-cameras";
import { Vector3 } from "three";
import { createCameraPanel } from "@zkmake/three-cameras/ui";

const lab = new CameraLab({ scene, renderer });

lab.entries(); // [{ id, kind, camera, inScene, live, fps, helper, viewing, views, … }]
lab.details("dolly"); // { position, rotation, local: { position, rotation }, projection }
lab.set("dolly", { fov: 30, position: [0, 2, 8] });
lab.lookThrough("dolly"); // null to go back
lab.setHelper("dolly", true);

const home = lab.saveView("dolly", "home");
lab.goToView("dolly", home.id, { duration: 800 });

lab.addKey("dolly", { time: 0 }); // the camera as it is now
lab.addKey("dolly", { time: 4, ease: "ease-out" });
lab.play(); // pause(), seek(2), stop(), setLoop(false), setDuration(12)

const [first] = lab.keys("dolly");
lab.updateKey("dolly", first.id, { bezier: [0.3, 1.4, 0.6, 1] }); // overshoot
lab.updateKey("dolly", first.id, { pose: writeChannel(first.pose, "fov", 30) });
lab.setTrail("dolly", true); // or false, or "auto" (the default)
lab.bakeMotion("dolly"); // its recorded move as keys
lab.moveKeyTo("dolly", home.id, new Vector3(0, 3, 8)); // a key to a world point

tab.append(createCameraPanel(lab).element); // the bare panel, for a host with its own tabs
```

## The dev-panel frame

It sits in three-meter's `mountDevPanel`, so it compacts and dims like the three-meter HUD and the
three-textures panel, with its brand label on top. With the timeline it's anchored across the
bottom (no drag grip); the list alone drags and snaps to an edge like the others.

## License

MIT
