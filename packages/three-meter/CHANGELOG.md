# @zkmake/three-meter

## 0.11.2

### Patch Changes

- [`a6c63d9`](https://github.com/zkmake/three-kit/commit/a6c63d993408f14dd5d18a0e0f2575256826d842) Thanks [@zkmake](https://github.com/zkmake)! - A docked panel keeps its edge when it or the window resizes, sliding along the edge to stay on screen; only a drop moves it to another edge. A panel docked in a corner that grew after mounting used to flip onto the side edge.

## 0.11.1

### Patch Changes

- [`b1ac65a`](https://github.com/zkmake/three-kit/commit/b1ac65a2325d09ac9dcf27eafcc04f76c7b4cb97) Thanks [@zkmake](https://github.com/zkmake)! - README: the live demo moved to [three-kit.pages.dev/three-meter](https://three-kit.pages.dev/three-meter/).

## 0.11.0

### Minor Changes

- [`16220c5`](https://github.com/zkmake/three-kit/commit/16220c5d00c2e9d3366b78467eefb831957dd383) Thanks [@zkmake](https://github.com/zkmake)! - The HUD's frame is now `mountDevPanel` in `./ui`, shared by every zkmake dev panel (three-textures uses it): the docked host, the drag / compact-full / dim discs, wake on approach, and a new brand label on top of the card. The card is a `.perf-hud__card` wrapping `.perf-monitor`, so styles that targeted `.perf-hud > .perf-monitor` now need `.perf-hud__card > .perf-monitor`.

## 0.10.0

### Minor Changes

- [#36](https://github.com/zkmake/three-kit/pull/36) [`f117ec4`](https://github.com/zkmake/three-kit/commit/f117ec47af32c420198bb0570a9f19032f0db7c0) Thanks [@zkmake](https://github.com/zkmake)! - Refresh-rate detection and hide-to-test.
  
  - **Refresh and Headroom rows.** Refresh is the rate the loop runs at when it keeps up (the display's refresh, or the app's own cap), detected from recent frames and snapped to a common rate. Headroom is the frame budget minus whichever of CPU and GPU took longer, amber below zero. Both are in `getFrameStats()` (`refreshHz`) and the copied report.
  - **Budgets follow the detected refresh rate** when `targetFps` isn't set, so a 120 Hz display gets 8.3 ms budgets instead of 60 Hz ones. An explicit `targetFps` still wins.
  - **Hide to test.** Each top-costs row has an eye that hides every matching object in the scene, on screen or not, and shows the GPU time it saved (CPU where there's no GPU timer). Hidden rows stay listed; everything is restored when top costs closes or the HUD is disposed. `CostEntry` gains a stable `key`, and `monitor.getObjectsForKey(key)` returns a row's objects.
  - The README's links to the demo's source point at its new home, `apps/three-meter-site`.

## 0.9.2

### Patch Changes

- [#33](https://github.com/zkmake/three-kit/pull/33) [`9fb9ac7`](https://github.com/zkmake/three-kit/commit/9fb9ac78b49955877f397812af064d0df97005ab) Thanks [@zkmake](https://github.com/zkmake)! - The source moved to the [zkmake/three-kit](https://github.com/zkmake/three-kit) monorepo (`packages/three-meter`); the package itself is unchanged. The footer's release link follows the monorepo's tag format, `@zkmake/three-meter@<version>`, and `repository`, `homepage` and `bugs` point at the new repo.

## 0.9.1

### Patch Changes

- [#31](https://github.com/zkmake/three-meter/pull/31) [`b2f24e4`](https://github.com/zkmake/three-meter/commit/b2f24e4bb03fb41c736b06bc1499fee93c984999) Thanks [@zkmake](https://github.com/zkmake)! - The dim-on-leave disc shows its state on its own: a solid accent disc when on, a plain one when off. The accent ring is now only hover and keyboard focus, so it no longer looks like the on state. Its tooltip reads "Dim on leave: on" or "off".

## 0.9.0

### Minor Changes

- [#28](https://github.com/zkmake/three-meter/pull/28) [`b13d012`](https://github.com/zkmake/three-meter/commit/b13d01249336c8aa50b913c7ff46404edb302070) Thanks [@zkmake](https://github.com/zkmake)! - The compact HUD's labels and graphs get the metric icons the full view has. Dim on leave moves out of the full view's options into a third disc on the floating HUD, under drag and expand; it lights up in the accent colour while on. `settings.dim` and its persistence are unchanged.

## 0.8.0

### Minor Changes

- [#26](https://github.com/zkmake/three-meter/pull/26) [`1ef9918`](https://github.com/zkmake/three-meter/commit/1ef99186f16b72ca595623adf027f7c296945292) Thanks [@zkmake](https://github.com/zkmake)! - Top costs: where the draw calls and triangles come from. A new "top costs" section in the full view lists the five biggest costs in the main render pass, by mesh or by material, sortable by calls or triangles; copies of one mesh share a row (`tree ×300`) so unmerged duplicates stand out, and clicking a row logs its objects to the console. Estimated from the scene graph the way three walks it (visibility, layers, frustum culling, material groups, two-pass transparent double-sided materials), matching `renderer.info` exactly on a test scene. The monitor finds the scene itself from the render call that drew the most. Also `monitor.getSceneCost()`, and the copied report gains the top three meshes.

## 0.7.0

### Minor Changes

- [#23](https://github.com/zkmake/three-meter/pull/23) [`959c0fb`](https://github.com/zkmake/three-meter/commit/959c0fb1f371eceda5a7f9ee4d20c6637ee32437) Thanks [@zkmake](https://github.com/zkmake)! - Budgets. A value past its budget turns amber in the full view and the compact HUD, with a tooltip naming the budget, and the FPS / CPU / GPU graphs draw it as a dashed line once the series reaches it. Timing budgets default from `targetFps` (60): FPS ≥ 95% of it, 1% low ≥ half, CPU and GPU within a frame, p99 within one and a half. Set your own with the `budgets` option on `mountPerfHud`, `PerfHud` and `PerformanceView` (e.g. `{ targetFps: 120, calls: 500 }`; `null` drops a default, `false` drops all), or later with `hud.setBudgets()`. New `--perf-warn` theme token.

## 0.6.0

### Minor Changes

- [#21](https://github.com/zkmake/three-meter/pull/21) [`4123782`](https://github.com/zkmake/three-meter/commit/41237824a063c0286f21347b88198f88ce2d9929) Thanks [@zkmake](https://github.com/zkmake)! - Friendlier full view. Each metric row gets an icon on the left and its checkbox moves to the right, after the value, matching the option rows. Every metric has a plain-language explanation: hover a label for it, or tick the new "explain metrics" option to show them under each row.

## 0.5.0

### Minor Changes

- [#19](https://github.com/zkmake/three-meter/pull/19) [`f7e84d2`](https://github.com/zkmake/three-meter/commit/f7e84d283d187c768b17b0c25e308493f3c86582) Thanks [@zkmake](https://github.com/zkmake)! - Stutter stats and a copyable bug report. The full view gains 1% low, frame p99 and hitch rows over the last `frameStatsSize` frames (default 1000), available to the compact HUD like any other row and through `PerformanceMonitor.getFrameStats()`. A new report row copies a Markdown snapshot (versions, backend, GPU, metrics, stutter stats, viewport, user agent) to the clipboard; `formatReport(monitor)` returns the same text.

## 0.4.0

### Minor Changes

- [#16](https://github.com/zkmake/three-meter/pull/16) [`06196be`](https://github.com/zkmake/three-meter/commit/06196be79df418912319a5430e6b006e57663092) Thanks [@zkmake](https://github.com/zkmake)! - Expanded HUD gets a footer: three-meter version (linked to its release notes), three revision, rendering backend (flagging a `WebGPURenderer` fallback to WebGL2) and GPU name. `PerformanceMonitor.getEnvironment()` exposes the same data. A checkbox, off by default, shows the footer in the compact HUD too.

## 0.3.2

### Patch Changes

- [#14](https://github.com/zkmake/three-meter/pull/14) [`620ba02`](https://github.com/zkmake/three-meter/commit/620ba02f103a9f5497f2a424d43e8197162e420b) Thanks [@zkmake](https://github.com/zkmake)! - Three measurement and lifecycle fixes.
  
  - **CPU was the frame interval, not JS time.** `end()` ran at the start of the next tick, so `cpu`
    equalled `1000 / fps` whenever the loop was vsync-bound and never showed headroom. CPU now runs
    from `begin()` to the return of the frame's last `render()` call (stamped by the existing
    `render` patch), in both `wrapAnimationLoop` and `PerfSampler`. `wrapAnimationLoop` also
    brackets the frame inside the tick and closes it even if your loop throws.
  - **Stalls no longer flatten the graphs.** A frame interval over one second (hidden tab,
    breakpoint) is left out of FPS instead of logging a near-zero sample that dominated the
    sparkline scale for the whole history window.
  - **`PerfHud` no longer remounts on every render** when `defaultPlacement` is an inline object
    literal; it is compared by value. `mode` and `label` now apply live through the handle, like
    `theme`.

## 0.3.1

### Patch Changes

- [#12](https://github.com/zkmake/three-meter/pull/12) [`288f377`](https://github.com/zkmake/three-meter/commit/288f37789efbdee19904ff0ff7b582a008a67275) Thanks [@zkmake](https://github.com/zkmake)! - Counts of 100,000 and up now show in compact notation (`250K`, `1.4M`, `1.2B`) instead of
  overflowing the compact card's value column into the next label; a scene with a million triangles
  read `1,076,708` across two cells. Smaller counts keep their exact thousands separators.

## 0.3.0

### Minor Changes

- [#5](https://github.com/zkmake/three-meter/pull/5) [`360e70d`](https://github.com/zkmake/three-meter/commit/360e70d693a889e5bde8f0099f8cb17822a43f4a) Thanks [@zkmake](https://github.com/zkmake)! - Let the person using the HUD pick its theme. The full view gains a light / system / dark row; the
  pick persists with the other settings under `storageKey` (`HudSettings.theme`, `setTheme`) and sits
  on top of the consumer's `theme` option, which still applies whenever nothing has been picked.
  `HudTheme` exposes the layers as `mode` (consumer), `override` (panel pick) and `effective`, with
  `setOverride` to drive the top layer; `resolved` follows `effective`.

## 0.2.0

### Minor Changes

- [#3](https://github.com/zkmake/three-meter/pull/3) [`b451117`](https://github.com/zkmake/three-meter/commit/b451117464bb6d613a36ceb883f469263841b2db) Thanks [@zkmake](https://github.com/zkmake)! - Add a light palette and a `theme` option to `mountPerfHud` and `PerfHud`: `dark`, `light`, or
  `system` (the default), which follows `prefers-color-scheme` live. The handle gains `getTheme`,
  `setTheme` and a `theme` controller whose `resolved` value and `subscribe` let a host page follow
  the HUD. In React the `theme` prop applies without remounting. Every colour in the stylesheet now
  comes from a `--perf-*` custom property, and the resolved theme lands on `data-theme` of `.perf-hud`
  and `.perf-monitor`.

## 0.1.1

### Patch Changes

- [`bb61f94`](https://github.com/zkmake/three-meter/commit/bb61f9455f3a219e188273620d8a9ca11904710f) Thanks [@zkmake](https://github.com/zkmake)! - Fix the published `exports`. 0.1.0 shipped a `development` condition pointing at `./src`, which is
  not in the tarball, so Vite dev servers and TypeScript with a `development` custom condition
  resolved to a missing file. Every condition now points at `dist/`.

## 0.1.0

### Minor Changes

- [`ec86646`](https://github.com/zkmake/three-meter/commit/ec86646b257462f0fd5299c018091a094c91a02a) Thanks [@zkmake](https://github.com/zkmake)! - First release. `PerformanceMonitor` (FPS, CPU ms, GPU ms on WebGL2 or WebGPU, draw calls, passes,
  triangles, resource counts), `mountPerfHud` (dockable, persisted DOM card), and the React Three
  Fiber pair `PerfSampler` / `PerfHud`.
