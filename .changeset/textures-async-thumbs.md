---
"@zkmake/three-textures": patch
---

The panel draws thumbnails of compressed and data textures without stalling the page: the GPU readback waits on a fence instead of the main thread. New `lab.thumbnailAsync(id, max)` and `readTextureAsync(...)` do the same for your own UI.
