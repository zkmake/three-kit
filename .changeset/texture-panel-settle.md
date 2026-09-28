---
"@zkmake/three-textures": patch
---

The panel looks for textures every 250 ms for its first 3 seconds, hidden or not, and again when the tab comes back into view. Textures that load after mount (a React Three Fiber scene, an async loader) now show up at once, instead of up to 2 seconds later, or only after a manual refresh in a tab the browser reports as hidden.
