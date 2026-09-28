---
"@zkmake/three-textures": patch
---

A swapped image can be any size or shape. three sizes a texture's GPU storage at its first upload, so an image of another size used to land in one corner (smaller) or not show at all (larger or another aspect ratio). A swap, A/B flip or revert that changes the size now disposes the textures on that image, and three reallocates them at the new size on the next frame.
