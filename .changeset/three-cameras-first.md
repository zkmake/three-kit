---
"@zkmake/three-cameras": minor
---

First release: a dev panel for the cameras in a three.js scene. Lists every camera in the scene and the one the renderer draws with (found by watching `renderer.render`, so R3F's default camera and a vanilla app's main camera show up), marks the live ones with their frame rate, reads position and projection live, and draws frustum helpers. `mountCameraPanel` for vanilla three, `<CameraPanel />` for React Three Fiber, `CameraLab` for scripting.
