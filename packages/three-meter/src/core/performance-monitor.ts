import { readEnvironment } from "./environment.ts";
import { computeFrameStats } from "./frame-stats.ts";
import { GpuTimer } from "./gpu-timer.ts";
import { RingBuffer } from "./ring-buffer.ts";
import { computeSceneCost } from "./scene-cost.ts";
import type {
  Environment,
  FrameStats,
  PerfRenderer,
  PerformanceMonitorOptions,
  Sample,
  SceneCost,
  TimingMetric,
} from "./types.ts";

const DEFAULT_GPU_POOL_SIZE = 5;
/** One monitor per renderer: a second would stack the `render` patch and double-count passes. */
const ATTACHED = new WeakSet<PerfRenderer>();
const DEFAULT_HISTORY_SIZE = 120;
const DEFAULT_FRAME_STATS_SIZE = 1000;
const FPS_SMOOTHING = 0.1;
/**
 * A frame interval past this is a stall (hidden tab, breakpoint, laptop lid),
 * not a slow frame. It is left out of FPS so one gap doesn't flatten the
 * graph's scale for the whole history window.
 */
const STALL_MS = 1000;

const frameCalls = (info: PerfRenderer["info"]) => info.render.drawCalls ?? info.render.calls;

const programCount = (info: PerfRenderer["info"]) =>
  info.memory.programs ?? info.programs?.length ?? 0;

/**
 * Collector of three.js frame metrics. Bracket each frame with {@link begin}/
 * {@link end}, or let {@link wrapAnimationLoop} or the R3F `PerfSampler` do it.
 * Works on WebGPURenderer (drawCalls, memory.programs, timestamp queries) and
 * on a WebGL renderer (calls, programs[], timer-query ext).
 *
 * While attached, `renderer.info.autoReset` is off and `info` is reset in
 * {@link begin}; host code that reads `renderer.info` mid-frame sees this
 * frame's counts only. {@link dispose} restores both.
 *
 * CPU time runs from {@link begin} to the return of the frame's last
 * `render()` call, which the `render` patch stamps. So it holds even when
 * {@link end} is only reached on the next tick, as in the R3F sampler: it is
 * the JS work of the frame, not the interval to the next one.
 */
class PerformanceMonitor {
  private readonly renderer: PerfRenderer;
  private readonly gpuTimer: GpuTimer | null;
  private readonly originalRender: PerfRenderer["render"];
  private renderPasses = 0;
  private lastRenderEndAt: number | null = null;
  private readonly fpsHistory: RingBuffer;
  private readonly cpuHistory: RingBuffer;
  private readonly gpuHistory: RingBuffer;
  private readonly frameIntervals: RingBuffer;
  private frameStats: FrameStats | null = null;
  /** The render call with the most draw calls this frame, and the scene and camera it drew. */
  private mainPassCalls = -1;
  private mainPass: { camera: WeakRef<object>; scene: WeakRef<object> } | null = null;
  private cpuStart = 0;
  private lastBeginAt: number | null = null;
  private frameFps = 0;
  private smoothedFps = 0;
  private sample: Sample;
  private environment: Environment | null = null;

  constructor(options: PerformanceMonitorOptions) {
    const {
      renderer,
      trackGPU = true,
      gpuQueryPoolSize = DEFAULT_GPU_POOL_SIZE,
      historySize = DEFAULT_HISTORY_SIZE,
      frameStatsSize = DEFAULT_FRAME_STATS_SIZE,
    } = options;

    if (ATTACHED.has(renderer)) {
      throw new Error(
        "three-meter: a PerformanceMonitor is already attached to this renderer. dispose() it first.",
      );
    }

    ATTACHED.add(renderer);
    this.renderer = renderer;
    renderer.info.autoReset = false;
    this.originalRender = renderer.render;

    renderer.render = (...args: never[]) => {
      this.renderPasses += 1;
      const callsBefore = frameCalls(renderer.info);

      try {
        return this.originalRender.apply(renderer, args);
      } finally {
        this.lastRenderEndAt = performance.now();
        this.notePass(args[0], args[1], frameCalls(renderer.info) - callsBefore);
      }
    };

    this.gpuTimer = trackGPU ? GpuTimer.create(renderer, gpuQueryPoolSize) : null;
    this.fpsHistory = new RingBuffer(historySize);
    this.cpuHistory = new RingBuffer(historySize);
    this.gpuHistory = new RingBuffer(historySize);
    this.frameIntervals = new RingBuffer(frameStatsSize);
    this.sample = this.buildEmptySample();
  }

  begin() {
    const now = performance.now();

    if (this.lastBeginAt !== null) {
      const frameMs = now - this.lastBeginAt;

      // A stall keeps the previous reading rather than logging a near-zero frame.
      if (frameMs > 0 && frameMs <= STALL_MS) {
        this.frameFps = 1000 / frameMs;
        this.frameIntervals.push(frameMs);
        this.frameStats = null;
      }
    }

    this.lastBeginAt = now;
    this.cpuStart = now;
    this.lastRenderEndAt = null;
    this.renderPasses = 0;
    this.mainPassCalls = -1;
    this.renderer.info.reset();
    this.gpuTimer?.begin();
  }

  end() {
    const now = performance.now();
    // Without a render this frame there is nothing better than "until end()".
    const cpu = (this.lastRenderEndAt ?? now) - this.cpuStart;

    this.gpuTimer?.end();
    this.gpuTimer?.poll();

    const gpuMs = this.gpuTimer?.getMs() ?? 0;

    this.smoothedFps =
      this.smoothedFps === 0
        ? this.frameFps
        : this.smoothedFps + (this.frameFps - this.smoothedFps) * FPS_SMOOTHING;

    this.fpsHistory.push(this.frameFps);
    this.cpuHistory.push(cpu);
    this.gpuHistory.push(gpuMs);

    const info = this.renderer.info;

    this.sample = Object.freeze({
      cpu,
      fps: this.smoothedFps,
      gpu: { available: this.gpuTimer !== null, ms: gpuMs },
      render: {
        calls: frameCalls(info),
        lines: info.render.lines,
        passes: this.renderPasses,
        points: info.render.points,
        triangles: info.render.triangles,
      },
      resources: {
        geometries: info.memory.geometries,
        programs: programCount(info),
        textures: info.memory.textures,
      },
    });
  }

  getSample(): Sample {
    return this.sample;
  }

  getHistory(metric: TimingMetric): readonly number[] {
    switch (metric) {
      case "fps":
        return this.fpsHistory.toArray();
      case "cpu":
        return this.cpuHistory.toArray();
      case "gpu":
        return this.gpuHistory.toArray();
    }
  }

  /** 1% low, p99 frame time and hitches. Computed on read, cached until the next frame. */
  getFrameStats(): FrameStats {
    this.frameStats ??= computeFrameStats(this.frameIntervals.toArray());

    return this.frameStats;
  }

  /**
   * Where the main pass's draw calls and triangles come from, by mesh and by
   * material. Walks the scene graph, so read it on demand (the HUD does, at
   * 2 Hz while its section is open), not every frame. `null` before the first
   * render, or once the scene is garbage collected.
   */
  getSceneCost(): SceneCost | null {
    const scene = this.mainPass?.scene.deref();
    const camera = this.mainPass?.camera.deref();

    return scene && camera ? computeSceneCost(scene, camera) : null;
  }

  /**
   * three revision, backend and GPU name. Cached once the backend is known;
   * before `WebGPURenderer.init()` settles it, `backend` is `null` and the
   * next call reads again.
   */
  getEnvironment(): Environment {
    if (this.environment) {
      return this.environment;
    }

    const environment = Object.freeze(readEnvironment(this.renderer));

    if (environment.backend !== null) {
      this.environment = environment;
    }

    return environment;
  }

  dispose() {
    ATTACHED.delete(this.renderer);
    this.renderer.info.autoReset = true;
    this.renderer.render = this.originalRender;
    this.gpuTimer?.dispose();
    this.fpsHistory.clear();
    this.cpuHistory.clear();
    this.gpuHistory.clear();
    this.frameIntervals.clear();
    this.frameStats = null;
    this.mainPass = null;
  }

  /**
   * The main pass is the render call that drew the most, so a post-processing
   * quad rendered last doesn't stand in for the scene. Weak references: the
   * monitor never keeps a scene alive.
   */
  private notePass(scene: unknown, camera: unknown, calls: number) {
    if (
      calls > this.mainPassCalls &&
      typeof scene === "object" &&
      scene !== null &&
      typeof camera === "object" &&
      camera !== null
    ) {
      this.mainPassCalls = calls;
      this.mainPass = { camera: new WeakRef(camera), scene: new WeakRef(scene) };
    }
  }

  private buildEmptySample(): Sample {
    return Object.freeze({
      cpu: 0,
      fps: 0,
      gpu: { available: this.gpuTimer !== null, ms: 0 },
      render: { calls: 0, lines: 0, passes: 0, points: 0, triangles: 0 },
      resources: { geometries: 0, programs: 0, textures: 0 },
    });
  }
}

export { PerformanceMonitor };
