---
"@zkmake/three-cameras": minor
---

Motion paths in the scene, and editable. A camera that moves shows its path by itself: a keyed camera its track with a dot per key, an app-driven one where it's been over the last 8 seconds. Drag a key's dot in the scene to move the key (Shift: straight up or down). "Bake to keys" turns an app-driven camera's recorded move into keys to edit. New on the lab: `setTrail(id, "auto")` (the default), `motion`, `bakeMotion`, `moveKeyTo`, `keyHandles`, `viewTransform`, and `moving` / `recorded` on entries. `createPathEditor` for a host of its own.
