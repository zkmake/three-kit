# @zkmake/three-cameras

## 0.2.2

### Patch Changes

- [`6b8fa7e`](https://github.com/zkmake/three-kit/commit/6b8fa7e3425760467a689167bb1d8e61dd0dac81) Thanks [@zkmake](https://github.com/zkmake)! - npm's homepage link now goes to the package's page on [zkmake.github.io/three-kit](https://zkmake.github.io/three-kit/) instead of its folder on GitHub.
- Updated dependencies [[`6b8fa7e`](https://github.com/zkmake/three-kit/commit/6b8fa7e3425760467a689167bb1d8e61dd0dac81)]:
  - @zkmake/three-meter@0.11.4

## 0.2.1

### Patch Changes

- [`9f90d79`](https://github.com/zkmake/three-kit/commit/9f90d79b7c9ab2d3340de08a23e0f553dd2b4f7d) Thanks [@zkmake](https://github.com/zkmake)! - README: the live demo moved to [zkmake.github.io/three-kit](https://zkmake.github.io/three-kit/).
- Updated dependencies [[`9f90d79`](https://github.com/zkmake/three-kit/commit/9f90d79b7c9ab2d3340de08a23e0f553dd2b4f7d)]:
  - @zkmake/three-meter@0.11.3

## 0.2.0

### Minor Changes

- [`52255b3`](https://github.com/zkmake/three-kit/commit/52255b3db357dbae7fbb0bf6dc22931d4cd66533) Thanks [@zkmake](https://github.com/zkmake)! - Curve and graph editors for camera moves. The key inspector shows the ease into the next key as a curve with two handles to drag (custom cubic Bézier eases, overshoot and anticipation included). The timeline's Graph view plots the picked camera's channels over time (position, rotation, fov or zoom, near, far) as they play; drag a key's dot to change that value or retime it, click between keys to pick a segment, double-click to add a key. A path toggle per lane draws the camera's motion path in the scene. New on the lab: `updateKey` takes `bezier` and `pose`, `setTrail`; and channel helpers `readChannel`, `writeChannel`, `sampleChannel`, plus `cubicBezier`.

- [`77e7fbf`](https://github.com/zkmake/three-kit/commit/77e7fbf2ebd16724daef03bbee8c4ae5b745db12) Thanks [@zkmake](https://github.com/zkmake)! - Motion paths in the scene, and editable. A camera that moves shows its path by itself: a keyed camera its track with a dot per key, an app-driven one where it's been over the last 8 seconds. Drag a key's dot in the scene to move the key (Shift: straight up or down). "Bake to keys" turns an app-driven camera's recorded move into keys to edit. New on the lab: `setTrail(id, "auto")` (the default), `motion`, `bakeMotion`, `moveKeyTo`, `keyHandles`, `viewTransform`, and `moving` / `recorded` on entries. `createPathEditor` for a host of its own.

- [`fdc9531`](https://github.com/zkmake/three-kit/commit/fdc95318c3bd18a08e57c2384c503c22c606ff9e) Thanks [@zkmake](https://github.com/zkmake)! - A keyframe timeline, in one panel with the camera list: anchored across the bottom of the screen, the list as its left sidebar with each camera's row beside its lane. Collapsed, a small widget with the picked camera; a click expands it. Key the picked camera at the playhead (or double-click its lane), drag keys to retime them, pick an ease into the next key (ease in-out, linear, ease in, ease out, hold), re-key from the camera, delete; play, pause (Space), scrub, loop and set the length. Cameras travel a smooth curve through their keys with their lens eased, and are held to their tracks right before each frame once played or scrubbed; an edit lets a camera go, `stop()` lets them all go. Tracks persist in localStorage. On the lab: `addKey`, `updateKey`, `deleteKey`, `keys`, `play`, `pause`, `seek`, `stop`, `setLoop`, `setDuration`, `timeline`, and `select` / `selected`, shared by the panels. `timeline: false` gives the list alone.

### Patch Changes

- Updated dependencies [[`a6c63d9`](https://github.com/zkmake/three-kit/commit/a6c63d993408f14dd5d18a0e0f2575256826d842)]:
  - @zkmake/three-meter@0.11.2

## 0.1.0

### Minor Changes

- [`7ca6561`](https://github.com/zkmake/three-kit/commit/7ca6561c137693bd0d683b2f1c98503f9d24d5db) Thanks [@zkmake](https://github.com/zkmake)! - First release: a dev panel for the cameras in a three.js scene. Lists every camera in the scene and the one the renderer draws with (found by watching `renderer.render`, so R3F's default camera and a vanilla app's main camera show up), marks the live ones with their frame rate, reads position and projection live, and draws frustum helpers. Pick a camera to control it: edit position, rotation and lens (type or scrub), look through it in place of the main view, copy it as code, and save views to fly back to. `mountCameraPanel` for vanilla three, `<CameraPanel />` for React Three Fiber, `CameraLab` for scripting.
