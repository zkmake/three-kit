# Capture and measure

Shooting the mockup page, and reading real frame numbers from it and from the app. Loaded by steps 4 and 5.

## Shots

- Start the receiver on the round folder in the background: `npx @zkmake/three-studio serve plans/<part>/mockups-<n>/`. On a taken port: `--port <free port>`, and `&shots=<that port>` on the page's URL.
- Start the app's dev server the project's way, open the mockup page in a browser you can script (a built-in browser pane, or a headless one), one session at a time, at a fixed viewport (1280 × 800 for desktop shots).
- Per variant: navigate to `?area=<area>&v=<variant>&view=play&t=<s>`, wait until `studio.stats()` reports triangles, then `await saveShot("<area>-<variant>-play.png")`. It resolves to the saved path and the readout (`"…png  38 calls · 112,400 tris"`): note both. `studio.setView("close")` then another `saveShot` for the close or wide shot, without a reload.
- `saveShot` works in a hidden or background tab. A variant that must animate there (a turntable, sway) needs `studio.installFrameShim()` once the page has mounted; frame rates from it mean nothing, draws and triangles still hold.
- `npx @zkmake/three-studio montage` lays `now` beside a variant for the gallery.
- When the round's shots are done: stop the receiver and the dev server, close the tab.

## Frame numbers in the app

The page's readout is the mockup's cost. The app's real frame comes from three-audit on the app's own scene: install its helpers there in dev (`installAuditHelpers(scene, { renderer })`) if the app doesn't already, then:

- `ledger()`: one frame's draw calls by object and by pass (shadow, main, post-processing), and each pass's size. In a background tab, `ledger({ render: () => … })` with the app's own render call.
- Measure each screen that matters: the level or play view, the menu or garage, the results.

## Scene totals

`summary()` and `census()` count every mesh in the scene, culled or not: they are the world's worth, not the frame's. Use them for counts per geometry and to spot unnamed geometry (`CircleGeometry:…`, `BufferGeometry:…`); use `ledger()` for what a frame really draws.
