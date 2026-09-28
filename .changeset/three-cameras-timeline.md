---
"@zkmake/three-cameras": minor
---

A keyframe timeline, in one panel with the camera list: anchored across the bottom of the screen, the list as its left sidebar with each camera's row beside its lane. Collapsed, a small widget with the picked camera; a click expands it. Key the picked camera at the playhead (or double-click its lane), drag keys to retime them, pick an ease into the next key (ease in-out, linear, ease in, ease out, hold), re-key from the camera, delete; play, pause (Space), scrub, loop and set the length. Cameras travel a smooth curve through their keys with their lens eased, and are held to their tracks right before each frame once played or scrubbed; an edit lets a camera go, `stop()` lets them all go. Tracks persist in localStorage. On the lab: `addKey`, `updateKey`, `deleteKey`, `keys`, `play`, `pause`, `seek`, `stop`, `setLoop`, `setDuration`, `timeline`, and `select` / `selected`, shared by the panels. `timeline: false` gives the list alone.
