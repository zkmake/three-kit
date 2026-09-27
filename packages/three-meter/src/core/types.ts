/**
 * App-agnostic frame metrics. The monitor talks to a three renderer (WebGPU or
 * WebGL) and never to the host app. GPU timing is real timestamps when the
 * backend can do them, otherwise `available: false`.
 */

type TimingMetric = "fps" | "cpu" | "gpu";

type GpuTiming = {
  ms: number;
  /** False when neither WebGPU timestamp queries nor the WebGL2 timer ext exist. */
  available: boolean;
};

type RenderCounts = {
  calls: number;
  triangles: number;
  lines: number;
  points: number;
  /** `renderer.render()` invocations this frame (shadows / extra passes). */
  passes: number;
};

type ResourceCounts = {
  geometries: number;
  textures: number;
  programs: number;
};

type Sample = {
  /** Smoothed. Intervals over a second (hidden tab, breakpoint) are left out. */
  fps: number;
  /**
   * JS time in ms from `begin()` to the return of the frame's last `render()`:
   * your update code plus the render dispatch. Falls back to `end()` when no
   * render ran.
   */
  cpu: number;
  gpu: GpuTiming;
  render: RenderCounts;
  resources: ResourceCounts;
};

/**
 * Stutter over the last `frameStatsSize` frame intervals (default 1000, about
 * 16 s at 60 Hz). Stalls over a second are left out.
 */
type FrameStats = {
  /** Intervals in the window. */
  frames: number;
  /** Frames over twice the window's median interval. */
  hitches: number;
  /** 1% low: mean FPS across the slowest 1% of frames. */
  lowFps: number;
  /** 99th percentile frame interval in ms. */
  p99Ms: number;
};

/** One row of {@link SceneCost}: a mesh (by label and geometry) or a material. */
type CostEntry = {
  /** Draw calls in the main pass. */
  calls: number;
  /** Instances drawn: an `InstancedMesh`'s count, 1 for anything else, summed over objects. */
  instances: number;
  /** Object name, else geometry name, else type; for materials, name else type. */
  label: string;
  /** The three objects behind this row, for inspecting in the console. */
  objects: unknown[];
  triangles: number;
};

/**
 * Where the main pass's draw calls and triangles come from, estimated from
 * the scene graph. Rows are sorted by calls, then triangles.
 */
type SceneCost = {
  calls: number;
  /** Grouped by material. */
  materials: CostEntry[];
  /** Grouped by label and geometry, so copies of one mesh share a row. */
  meshes: CostEntry[];
  triangles: number;
};

/** `webgl` is WebGL 1, which three dropped in r163. */
type RenderBackend = "webgpu" | "webgl2" | "webgl";

/** What the monitor is running on, for bug reports. `null` where it can't be read. */
type Environment = {
  /** `null` until `WebGPURenderer` finishes `init()`. */
  backend: RenderBackend | null;
  /** `WebGPURenderer` asked for WebGPU and fell back to its WebGL2 backend. */
  fallback: boolean;
  /** Adapter or unmasked renderer name, e.g. `Apple M3 Pro`. Browsers may hide it. */
  gpu: string | null;
  /** three's revision from `window.__THREE__`, e.g. `"186"`. */
  three: string | null;
};

/**
 * The slice of a three renderer the monitor needs. WebGPU's `info.render` uses
 * `drawCalls` for this frame; WebGL's uses `calls`. `programs` is a cache array
 * on WebGL and a count on `info.memory` on WebGPU.
 */
type PerfRenderer = {
  /** WebGPURenderer's backend; read as `{ trackTimestamp?: boolean }` at runtime. */
  backend?: unknown;
  getContext?: () => unknown;
  info: {
    autoReset: boolean;
    memory: { geometries: number; programs?: number; textures: number };
    programs?: { length: number } | null;
    render: {
      calls: number;
      drawCalls?: number;
      lines: number;
      points: number;
      timestamp?: number;
      triangles: number;
    };
    reset: () => void;
  };
  /** `never[]` so any concrete `render(scene, camera)` signature is assignable. */
  render: (...args: never[]) => unknown;
  resolveTimestampsAsync?: (type?: "render") => Promise<number | undefined>;
};

type PerformanceMonitorOptions = {
  renderer: PerfRenderer;
  /** Measure real GPU time. Auto-disabled if unsupported. Default true. */
  trackGPU?: boolean;
  /** WebGL2 timer-query pool depth. Default 5. Unused on WebGPU. */
  gpuQueryPoolSize?: number;
  /** Ring-buffer length backing the graphs. Default 120. */
  historySize?: number;
  /** Frame intervals behind {@link FrameStats}. Default 1000. */
  frameStatsSize?: number;
};

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
};
