# @zkmake/three-quality

Render quality that adapts to the device, in the game you ship. It watches frame times, steps the
renderer's pixel ratio down when frames run slow and back up when there's room, then turns off the
app's own quality tiers (shadows, bloom) if the ratio alone isn't enough. The settled setting is
remembered per device, so the next visit starts there. Zero dependencies, WebGL and WebGPU, vanilla
three or React Three Fiber.

```sh
bun add @zkmake/three-quality   # or npm i / pnpm add
```

A runtime package, not a dev tool: install it as a normal dependency. It's for the games that run on
whatever a school hands out. A Chromebook drawing a full-window canvas at 2× pushes four times the
pixels of 1×, and a hard-coded `dpr={[1, 2]}` can't tell which machine it's on.

Entries: `@zkmake/three-quality` (vanilla, no dependencies) and `@zkmake/three-quality/react`
(needs `react` and `@react-three/fiber`).

## Vanilla three

```ts
import { adaptQuality } from "@zkmake/three-quality";

const quality = adaptQuality(renderer, {
  tiers: [{ name: "shadows", set: (on) => (renderer.shadowMap.enabled = on) }],
});

quality.onChange((state) => console.log(state.dpr, state.phase));
// later: quality.dispose()
```

It times frames with its own `requestAnimationFrame` and calls `renderer.setPixelRatio`. To time
from your loop instead, pass `measure: "manual"` and call `quality.update(frameMs)` once a frame.
A window resize recomputes the ladder; after resizing the canvas some other way, call
`quality.refresh()`. `dispose()` stops measuring and leaves the last setting applied.

## React Three Fiber

```tsx
import { AdaptiveQuality, useQualityTier } from "@zkmake/three-quality/react";

<Canvas dpr={1}>
  <AdaptiveQuality tiers={["shadows", "bloom"]} />
  <Scene />
</Canvas>;

function Lights() {
  const shadows = useQualityTier("shadows"); // true until the controller turns it off
  return <directionalLight castShadow={shadows} />;
}
```

`<AdaptiveQuality>` sets the Canvas's ratio through R3F's `setDpr`, timed from `useFrame`'s delta,
and holds it when R3F puts the Canvas's own `dpr` prop back (a re-render of the Canvas, a display
change). The Canvas's `dpr` is only the first frame's. `useAdaptiveQuality()` returns the whole
state anywhere on the page, inside the Canvas or out; `qualityStore.get()` is the controller, for
`pin`. Both read a shared store, which crosses R3F's reconciler boundary where a context can't; to
run two canvases, pass each its own `createQualityStore()` as `store`, and the same store to the
hooks (`useAdaptiveQuality(store)`, `useQualityTier(name, store)`). Its options are compared by
value, so inline literals are fine; a change remounts the controller. A tier's `set` is read live.

## How it decides

- **Measure**: only the frame timestamps the loop already has. No GPU timer queries, so it costs
  nothing and works the same on WebGL and WebGPU. Frames are judged a second at a time on the
  window's 90th-percentile frame, so one hitch (a shader compiling) never counts.
- **Step down**: a window whose p90 frame is over the budget (`1000 / targetFps`) by more than 20%
  steps one rung down.
- **Check it paid**: the next window has to be faster. If the mean frame didn't drop by 10% and
  isn't on target (slipping just under the slow line doesn't count), the frame isn't bound by
  pixels (it's the CPU, or the scene), so the step is undone and lowering stops: phase
  `cpu-bound`. Blurring the picture for nothing is the one thing it won't do. A noisy window (a
  shader compiling mid-check) can fake that verdict, so after 15 s still slow it tries again, then
  after 30 s, then every minute.
- **Step up**: after 5 s on target it tries a rung up. A vsynced frame can't show spare time (it's
  never shorter than the refresh), so trying is the only way to find out. If that turns slow
  within three windows it goes back and waits twice as long before trying again, up to a minute.
  That's the hysteresis: it doesn't oscillate.
- **Ignore**: the first 2 s (shaders, uploads), half a second after each change (a new ratio
  reallocates the drawing buffer), and any frame over 250 ms (a hidden tab) along with its window.

The ladder runs from the ceiling down in 0.25 steps to `minDpr`. The ceiling is the display's ratio,
capped at `maxDpr` and so the whole canvas stays under `maxPixels`: a big monitor gets a lower
ratio than a laptop lid. A 1.5× screen with an 800 × 600 canvas gets 1.5, 1.25, 1. A step less
than half a `dprStep` below the ceiling buys nothing and is skipped: 1.27 goes to 1. Tiers go off
after the ratio bottoms out, one at a time in the order given, and back on in reverse. If your tiers
save CPU rather than pixels (shadow passes add draw calls), pass `tiersFirst`, so they're tried
before a `cpu-bound` verdict stops the ratio steps.

## Options

`adaptQuality(renderer, options)` and `<AdaptiveQuality>` take:

| Option       | Default           | Meaning                                                                           |
| ------------ | ----------------- | --------------------------------------------------------------------------------- |
| `targetFps`  | `60`              | The frame rate to hold. A 120 Hz screen still holds 60: a game doesn't need more. |
| `maxDpr`     | `2`               | The highest ratio.                                                                |
| `minDpr`     | `1`               | The lowest. `0.75` buys a slow Chromebook a lot, a little soft.                   |
| `maxPixels`  | `1_650_000`       | The most device pixels the canvas may have, which caps the ratio.                 |
| `dprStep`    | `0.25`            | The gap between ratios.                                                           |
| `tiers`      | `[]`              | Names, or `{ name, set(on) }`, turned off in order once the ratio bottoms out.    |
| `tiersFirst` | `false`           | Turn tiers off before lowering the ratio.                                         |
| `storageKey` | `"three-quality"` | localStorage key for the settled setting. `null` keeps nothing.                   |
| `measure`    | `"raf"`           | Vanilla only. `"manual"`: call `update(frameMs)` from your loop.                  |
| `slowAt`     | `0.2`             | How far over budget a window's p90 frame has to be to count as slow.              |
| `upAfterMs`  | `5000`            | Time on target before trying a rung up.                                           |
| `windowMs`   | `1000`            | Frame time per judgement.                                                         |
| `warmupMs`   | `2000`            | Frame time ignored at the start.                                                  |

Also `settleMs` (500), `gapMs` (250), `maxUpAfterMs` (60000), `minGain` (0.1), `storage` (where
the setting is kept, default `localStorage`), `devicePixelRatio`, and, vanilla only, for hosts that
size the canvas themselves, `setDpr` and `size`.

## State

`quality.state`, new on every change; `quality.level` and `quality.dpr` are shortcuts to two of its
fields:

```ts
{
  dpr: 1.25,              // applied
  level: 1, levels: 5,    // 0 is the best rung
  phase: "steady",        // "warming" | "adapting" | "steady" | "cpu-bound" | "pinned"
  tiers: { shadows: true, bloom: true },
  p90Ms: 16.9,            // last window's p90 frame
  targetFps: 60,
}
```

## A player's choice

A settings menu's "Low / High quality" pins a rung, and the pin is remembered:

```ts
quality.pin(quality.state.levels - 1); // cheapest
quality.pin(0); // best
quality.pin(null); // automatic again
```

In React: `qualityStore.get()?.pin(level)`.

## In three-meter's HUD

[three-meter](../three-meter)'s `?debug` HUD shows it as one line, `dpr 1.25 · adapting`:
`mountPerfHud(monitor, { quality })`, or `<PerfHud quality={qualityStore} />`. It reads the state
by shape, so neither package depends on the other. [three-devtools](../three-devtools) passes it
on: `<DevTools quality={qualityStore} />`, or `mountDevTools({ quality })` with the handle.

## The pure parts

`createQualityController({ levels, … })` is the decision alone: `add(frameMs)` returns the new
level when it changes, with `state`, `pin(level)` and `reset(levels, level)` beside it.
`pixelRatioCeiling`, `buildLadder` and `levelOf` are the ladder. No DOM, so they run in Node tests.

Origin: turbo-typers' frame pace (p90 over a window, warmup, gap reset) and keyboard-express's
pixel budget for its full-window canvas, both in edclub's games.
