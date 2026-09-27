/**
 * Real GPU frame timing.
 *
 * WebGPU: Three's `trackTimestamp` + `resolveTimestampsAsync` (ms, a frame or
 * two late). Never calls `getExtension`: that is what remounted the canvas.
 *
 * WebGL2 fallback (Safari without WebGPU, or a forced GL backend):
 * `EXT_disjoint_timer_query_webgl2`, same pool-of-queries pattern as the
 * platform-typing monitor.
 */
import type { PerfRenderer } from "./types.ts";

type DisjointTimerQueryExt = {
  readonly GPU_DISJOINT_EXT: number;
  readonly TIME_ELAPSED_EXT: number;
};

class GpuTimer {
  private lastMs = 0;
  private readonly webgpu: PerfRenderer | null;
  private webgpuInFlight = false;
  private readonly gl: WebGL2RenderingContext | null;
  private readonly ext: DisjointTimerQueryExt | null;
  private readonly free: WebGLQuery[] = [];
  private readonly pending: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;

  private constructor(
    webgpu: PerfRenderer | null,
    gl: WebGL2RenderingContext | null,
    ext: DisjointTimerQueryExt | null,
    poolSize: number,
  ) {
    this.webgpu = webgpu;
    this.gl = gl;
    this.ext = ext;

    if (!gl) {
      return;
    }

    for (let index = 0; index < poolSize; index += 1) {
      const query = gl.createQuery();

      if (query) {
        this.free.push(query);
      }
    }
  }

  static create(renderer: PerfRenderer, poolSize: number): GpuTimer | null {
    const backend = renderer.backend as { trackTimestamp?: boolean } | undefined;

    if (backend?.trackTimestamp && renderer.resolveTimestampsAsync) {
      return new GpuTimer(renderer, null, null, poolSize);
    }

    const context = renderer.getContext?.();

    if (!(context instanceof WebGL2RenderingContext)) {
      return null;
    }

    const ext = context.getExtension(
      "EXT_disjoint_timer_query_webgl2",
    ) as DisjointTimerQueryExt | null;

    return ext ? new GpuTimer(null, context, ext, poolSize) : null;
  }

  begin() {
    if (this.webgpu || !this.gl || !this.ext) {
      return;
    }

    const query = this.free.pop();

    if (!query) {
      this.active = null;

      return;
    }

    this.active = query;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
  }

  end() {
    if (this.webgpu || !this.gl || !this.ext || !this.active) {
      return;
    }

    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  poll() {
    if (this.webgpu) {
      this.pollWebgpu();

      return;
    }

    this.pollWebgl();
  }

  getMs() {
    return this.lastMs;
  }

  dispose() {
    if (this.gl && this.ext && this.active) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.active = null;
    }

    if (this.gl) {
      for (const query of this.free) {
        this.gl.deleteQuery(query);
      }

      for (const query of this.pending) {
        this.gl.deleteQuery(query);
      }
    }

    this.free.length = 0;
    this.pending.length = 0;
  }

  private pollWebgpu() {
    const resolve = this.webgpu?.resolveTimestampsAsync;

    if (!resolve || this.webgpuInFlight) {
      return;
    }

    this.webgpuInFlight = true;

    void resolve
      .call(this.webgpu, "render")
      .then((ms) => {
        if (typeof ms === "number" && Number.isFinite(ms)) {
          this.lastMs = ms;
        }

        this.webgpuInFlight = false;
      })
      .catch(() => {
        this.webgpuInFlight = false;
      });
  }

  private pollWebgl() {
    if (!this.gl || !this.ext) {
      return;
    }

    const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;

    if (disjoint) {
      while (this.pending.length > 0) {
        this.free.push(this.pending.shift()!);
      }

      return;
    }

    while (this.pending.length > 0) {
      const query = this.pending[0]!;
      const ready = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE) as boolean;

      if (!ready) {
        break;
      }

      this.pending.shift();
      const ns = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT) as number;
      this.lastMs = ns / 1e6;
      this.free.push(query);
    }
  }
}

export { GpuTimer };
