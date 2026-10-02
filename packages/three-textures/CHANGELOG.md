# @zkmake/three-textures

## 0.1.6

### Patch Changes

- [`43755a9`](https://github.com/zkmake/three-kit/commit/43755a946ff4e6876747291e7223602919d09aca) Thanks [@zkmake](https://github.com/zkmake)! - The panel draws thumbnails of compressed and data textures without stalling the page: the GPU readback waits on a fence instead of the main thread. New `lab.thumbnailAsync(id, max)` and `readTextureAsync(...)` do the same for your own UI.
- Updated dependencies [[`2d9eff6`](https://github.com/zkmake/three-kit/commit/2d9eff6fa0035a87b0c307ddb02c72e6ffc88486)]:
  - @zkmake/three-meter@0.11.5

## 0.1.5

### Patch Changes

- [`6b8fa7e`](https://github.com/zkmake/three-kit/commit/6b8fa7e3425760467a689167bb1d8e61dd0dac81) Thanks [@zkmake](https://github.com/zkmake)! - npm's homepage link now goes to the package's page on [zkmake.github.io/three-kit](https://zkmake.github.io/three-kit/) instead of its folder on GitHub.
- Updated dependencies [[`6b8fa7e`](https://github.com/zkmake/three-kit/commit/6b8fa7e3425760467a689167bb1d8e61dd0dac81)]:
  - @zkmake/three-meter@0.11.4

## 0.1.4

### Patch Changes

- [`9f90d79`](https://github.com/zkmake/three-kit/commit/9f90d79b7c9ab2d3340de08a23e0f553dd2b4f7d) Thanks [@zkmake](https://github.com/zkmake)! - README: the live demo moved to [zkmake.github.io/three-kit](https://zkmake.github.io/three-kit/).
- Updated dependencies [[`9f90d79`](https://github.com/zkmake/three-kit/commit/9f90d79b7c9ab2d3340de08a23e0f553dd2b4f7d)]:
  - @zkmake/three-meter@0.11.3

## 0.1.3

### Patch Changes

- [`398ebe3`](https://github.com/zkmake/three-kit/commit/398ebe357cbe2c968660aa4c5ffc63bb6e379c7d) Thanks [@zkmake](https://github.com/zkmake)! - Clearer, larger row icons: download, swap in a file, live link (a pulsing dot while live), A/B and undo, which show only once a row has a swap. Tooltips say what Download saves: the swap, the source file, or a GPU readback. The preview opens right beside the panel, on the side facing the middle of the screen, level with its row, and follows the panel as it's dragged.

## 0.1.2

### Patch Changes

- [`b03118c`](https://github.com/zkmake/three-kit/commit/b03118c04ba0c2580dce29ab3581922531054ff8) Thanks [@zkmake](https://github.com/zkmake)! - A swapped image can be any size or shape. three sizes a texture's GPU storage at its first upload, so an image of another size used to land in one corner (smaller) or not show at all (larger or another aspect ratio). A swap, A/B flip or revert that changes the size now disposes the textures on that image, and three reallocates them at the new size on the next frame.

## 0.1.1

### Patch Changes

- [`ca92ec8`](https://github.com/zkmake/three-kit/commit/ca92ec83ca70c89fb3d61c455c652253fd830ac2) Thanks [@zkmake](https://github.com/zkmake)! - The panel looks for textures every 250 ms for its first 3 seconds, hidden or not, and again when the tab comes back into view. Textures that load after mount (a React Three Fiber scene, an async loader) now show up at once, instead of up to 2 seconds later, or only after a manual refresh in a tab the browser reports as hidden.

## 0.1.0

### Minor Changes

- [`16220c5`](https://github.com/zkmake/three-kit/commit/16220c5d00c2e9d3366b78467eefb831957dd383) Thanks [@zkmake](https://github.com/zkmake)! - First release: a dev panel for the textures in a three.js scene. Preview, download (GPU readback for compressed and data textures), swap in painted images live, A/B against the original, keep swaps across reloads in IndexedDB, and live-link a file so every save shows in the scene. Compressed (KTX2) textures swap by rebinding an image twin with the same settings. Docks, dims and toggles like the three-meter HUD (both use its `mountDevPanel` frame). Vanilla (`./ui`) and React Three Fiber (`./react`).

### Patch Changes

- Updated dependencies [[`16220c5`](https://github.com/zkmake/three-kit/commit/16220c5d00c2e9d3366b78467eefb831957dd383)]:
  - @zkmake/three-meter@0.11.0
