# Verification

How to see and measure. Screenshots are the evidence for every visual claim; numbers come from the console helpers.

## Screenshots

Drive the studio in a browser you can script: a built-in browser pane if your environment has one, or a headless one (`agent-browser`, Playwright). Run one browser session at a time: parallel ones saturate the CPU. The page saves its own canvas with `saveShot(path)`, through `three-studio serve`, so the PNGs land on disk where `three-studio diff` and `montage` can use them.

Once per pass:

1. Pick a pass folder in the project (`plans/<object>/pass-<n>/`, or a scratch folder when nothing should be committed) and start the receiver on it in the background:

   ```bash
   npx @zkmake/three-studio serve <pass folder>   # 127.0.0.1:8787; bunx / pnpm dlx work too
   ```

2. Start the app's dev server the project's way and open the studio at its area and view (`…/studio.html?windmill&view=play`). Set a fixed viewport (1200 × 800) so every shot of a pass has one size.

Per shot, in the page:

```js
await saveShot("before-play.png");
// "/abs/…/pass-1/before-play.png  14 calls · 4,812 tris"
```

`saveShot` draws a frame and reads it in the same task, so it works in a hidden or background tab where `requestAnimationFrame` never fires. Paths are relative to the receiver's folder (or absolute inside it). `studio.setView("close")` moves the camera without a reload; switching area or variant is a navigation.

- **Look at every shot** (open the PNG) before trusting it. A blank or half-built frame on a heavy scene usually means it hasn't finished loading: wait for `studio.stats()` to report triangles, then shoot again.
- **Animated scenes**: shoot with `&t=<seconds>` so every shot has one pose. A hidden tab that must animate (a sway, a turntable) needs `studio.installFrameShim()` after the scene mounts; frame rates from it mean nothing, draws and triangles still hold.
- **Helpers** the same way: `JSON.stringify(threeAudit.report("<tag>"))`, or `summary`, `zfight()`, `audit()`, `meshes().slice(0, 10)` one by one.
- **Frame cost in the app itself** (not the studio): with three-audit's helpers installed on the app's scene in dev, `ledger()` gives one frame's draws by object and pass; in a background tab, `ledger({ render })` with the app's own render call. Studio and scene totals (`tris()`, `census()`) count every mesh, culled or not: the world's worth, not the frame's.
- **End of pass**: stop the receiver and the dev server, and close the tab.

## Before and after

- Shoot _before_ first. If the edit already happened, `git stash`, reshoot, `git stash pop`.
- One comparison image per pass, one row per view (close, play, any detail view), before on the left:

  ```bash
  npx @zkmake/three-studio montage compare.png before-close.png after-close.png before-play.png after-play.png
  ```

  Send it to the user.

- **Remodels** are judged by eye on the close and play rows: does it read as one object, true to its nature and the style guide?
- **Changes meant to be invisible** (far copies, culling cells, material refactors) are judged by pixel diff at the play view:

  ```bash
  npx @zkmake/three-studio diff before-play.png after-play.png --out diff.png
  ```

  About 0.01% of pixels differing is identical; anything visible in the montage is not. `--max <percent>` makes it exit 1 above a threshold, so a stored baseline can gate CI.

## Black frames

For passes that add new kinds of geometry to anything that moves or glows. Needs a visible browser window (headless ones have not reproduced black frames) and the app itself, not the studio, with its post-processing on.

1. Install three-audit's helpers on the app's scene in dev, with the renderer (`installAuditHelpers(scene, { renderer })`), if the app doesn't already.
2. Open the app, start play so the object moves on screen.
3. `await blackFrames(10)`: `{ frames, blackFrames }` over the next 10 s.
4. Pass: `blackFrames` empty over a few hundred `frames`. A positive control (temporarily restoring a suspect) proves the setup catches them.

## Checks

The project's own typecheck, lint, tests and build, taken from `package.json` scripts (or the project's hooks, where it runs them itself), all green before the report.
