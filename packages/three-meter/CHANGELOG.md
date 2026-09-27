# @zkmake/three-meter

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
