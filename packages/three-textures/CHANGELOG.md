# @zkmake/three-textures

## 0.1.0

### Minor Changes

- [`16220c5`](https://github.com/zkmake/three-kit/commit/16220c5d00c2e9d3366b78467eefb831957dd383) Thanks [@zkmake](https://github.com/zkmake)! - First release: a dev panel for the textures in a three.js scene. Preview, download (GPU readback for compressed and data textures), swap in painted images live, A/B against the original, keep swaps across reloads in IndexedDB, and live-link a file so every save shows in the scene. Compressed (KTX2) textures swap by rebinding an image twin with the same settings. Docks, dims and toggles like the three-meter HUD (both use its `mountDevPanel` frame). Vanilla (`./ui`) and React Three Fiber (`./react`).

### Patch Changes

- Updated dependencies [[`16220c5`](https://github.com/zkmake/three-kit/commit/16220c5d00c2e9d3366b78467eefb831957dd383)]:
  - @zkmake/three-meter@0.11.0
