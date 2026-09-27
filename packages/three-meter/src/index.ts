/**
 * `@zkmake/three-meter`: frame metrics for a three.js renderer, no UI.
 *
 * Zero dependencies. The renderer contract is the structural {@link PerfRenderer}
 * type, satisfied by `WebGLRenderer` and `WebGPURenderer` alike. The HUD is
 * `./ui`; the React Three Fiber pair is `./react`.
 */

export { PerformanceMonitor } from "./core/performance-monitor.ts";
export { RingBuffer } from "./core/ring-buffer.ts";
export { wrapAnimationLoop } from "./core/wrap-animation-loop.ts";
export type {
  CostEntry,
  Environment,
  FrameStats,
  GpuTiming,
  PerfRenderer,
  PerformanceMonitorOptions,
  RenderBackend,
  RenderCounts,
  ResourceCounts,
  Sample,
  SceneCost,
  TimingMetric,
} from "./core/types.ts";
