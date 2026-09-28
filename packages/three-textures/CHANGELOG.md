# @zkmake/three-textures

## 0.1.1

### Patch Changes

- [`ca92ec8`](https://github.com/zkmake/three-kit/commit/ca92ec83ca70c89fb3d61c455c652253fd830ac2) Thanks [@zkmake](https://github.com/zkmake)! - The panel looks for textures every 250 ms for its first 3 seconds, hidden or not, and again when the tab comes back into view. Textures that load after mount (a React Three Fiber scene, an async loader) now show up at once, instead of up to 2 seconds later, or only after a manual refresh in a tab the browser reports as hidden.

## 0.1.0

### Minor Changes

- [`16220c5`](https://github.com/zkmake/three-kit/commit/16220c5d00c2e9d3366b78467eefb831957dd383) Thanks [@zkmake](https://github.com/zkmake)! - First release: a dev panel for the textures in a three.js scene. Preview, download (GPU readback for compressed and data textures), swap in painted images live, A/B against the original, keep swaps across reloads in IndexedDB, and live-link a file so every save shows in the scene. Compressed (KTX2) textures swap by rebinding an image twin with the same settings. Docks, dims and toggles like the three-meter HUD (both use its `mountDevPanel` frame). Vanilla (`./ui`) and React Three Fiber (`./react`).

### Patch Changes

- Updated dependencies [[`16220c5`](https://github.com/zkmake/three-kit/commit/16220c5d00c2e9d3366b78467eefb831957dd383)]:
  - @zkmake/three-meter@0.11.0
