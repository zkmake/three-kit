# @zkmake/three-cameras

## 0.1.0

### Minor Changes

- [`7ca6561`](https://github.com/zkmake/three-kit/commit/7ca6561c137693bd0d683b2f1c98503f9d24d5db) Thanks [@zkmake](https://github.com/zkmake)! - First release: a dev panel for the cameras in a three.js scene. Lists every camera in the scene and the one the renderer draws with (found by watching `renderer.render`, so R3F's default camera and a vanilla app's main camera show up), marks the live ones with their frame rate, reads position and projection live, and draws frustum helpers. Pick a camera to control it: edit position, rotation and lens (type or scrub), look through it in place of the main view, copy it as code, and save views to fly back to. `mountCameraPanel` for vanilla three, `<CameraPanel />` for React Three Fiber, `CameraLab` for scripting.
