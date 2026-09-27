---
"@zkmake/three-meter": minor
---

Refresh-rate detection and hide-to-test.

- **Refresh and Headroom rows.** Refresh is the rate the loop runs at when it keeps up (the display's refresh, or the app's own cap), detected from recent frames and snapped to a common rate. Headroom is the frame budget minus whichever of CPU and GPU took longer, amber below zero. Both are in `getFrameStats()` (`refreshHz`) and the copied report.
- **Budgets follow the detected refresh rate** when `targetFps` isn't set, so a 120 Hz display gets 8.3 ms budgets instead of 60 Hz ones. An explicit `targetFps` still wins.
- **Hide to test.** Each top-costs row has an eye that hides every matching object in the scene, on screen or not, and shows the GPU time it saved (CPU where there's no GPU timer). Hidden rows stay listed; everything is restored when top costs closes or the HUD is disposed. `CostEntry` gains a stable `key`, and `monitor.getObjectsForKey(key)` returns a row's objects.
- The README's links to the demo's source point at its new home, `apps/three-meter-site`.
