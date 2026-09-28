---
"@zkmake/three-textures": minor
---

First release: a dev panel for the textures in a three.js scene. Preview, download (GPU readback for compressed and data textures), swap in painted images live, A/B against the original, keep swaps across reloads in IndexedDB, and live-link a file so every save shows in the scene. Compressed (KTX2) textures swap by rebinding an image twin with the same settings. Docks, dims and toggles like the three-meter HUD (both use its `mountDevPanel` frame). Vanilla (`./ui`) and React Three Fiber (`./react`).
