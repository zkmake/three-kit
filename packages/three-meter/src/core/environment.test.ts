import { afterEach, describe, expect, test, vi } from "vitest";

import { cleanGpuName, readEnvironment } from "./environment.ts";
import { PerformanceMonitor } from "./performance-monitor.ts";
import type { PerfRenderer } from "./types.ts";

const UNMASKED_RENDERER_WEBGL = 0x9246;
const RENDERER = 0x1f01;

/** Node has no WebGL; a stand-in class so `instanceof` checks hold. */
class FakeWebgl2 {
  readonly RENDERER = RENDERER;
  private readonly name: string;
  private readonly debugExt: boolean;

  constructor(name: string, debugExt = true) {
    this.name = name;
    this.debugExt = debugExt;
  }

  getExtension(name: string) {
    return name === "WEBGL_debug_renderer_info" && this.debugExt
      ? { UNMASKED_RENDERER_WEBGL }
      : null;
  }

  getParameter(parameter: number) {
    return parameter === UNMASKED_RENDERER_WEBGL || !this.debugExt ? this.name : "WebKit WebGL";
  }
}

const info = (): PerfRenderer["info"] => ({
  autoReset: true,
  memory: { geometries: 0, textures: 0 },
  render: { calls: 0, lines: 0, points: 0, triangles: 0 },
  reset: () => {},
});

const withContext = (context: unknown): PerfRenderer => ({
  getContext: () => context,
  info: info(),
  render: () => {},
});

const withBackend = (backend: unknown): PerfRenderer => ({
  backend,
  info: info(),
  render: () => {},
});

describe("cleanGpuName", () => {
  test.each([
    ["ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)", "Apple M3 Pro"],
    [
      "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "NVIDIA GeForce RTX 4070",
    ],
    [
      "ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)",
      "Mesa Intel(R) UHD Graphics 620 (KBL GT2)",
    ],
    ["Apple GPU", "Apple GPU"],
    ["  Radeon R9 200 Series  ", "Radeon R9 200 Series"],
  ])("%s", (raw, expected) => {
    expect(cleanGpuName(raw)).toBe(expected);
  });
});

describe("readEnvironment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("three revision comes from window.__THREE__", () => {
    vi.stubGlobal("__THREE__", "186");
    expect(readEnvironment(withBackend({ isWebGPUBackend: true })).three).toBe("186");
  });

  test("no three on the page reads null", () => {
    expect(readEnvironment(withBackend({ isWebGPUBackend: true })).three).toBeNull();
  });

  test("WebGPU before init() has no backend yet", () => {
    const environment = readEnvironment(withBackend({ device: null, isWebGPUBackend: true }));
    expect(environment.backend).toBeNull();
    expect(environment.gpu).toBeNull();
  });

  test("WebGPU names the adapter, preferring its description", () => {
    const described = withBackend({
      device: {
        adapterInfo: { architecture: "metal-3", description: "Apple M3 Pro", vendor: "apple" },
      },
      isWebGPUBackend: true,
    });
    const bare = withBackend({
      device: { adapterInfo: { architecture: "metal-3", description: "", vendor: "apple" } },
      isWebGPUBackend: true,
    });

    expect(readEnvironment(described)).toMatchObject({
      backend: "webgpu",
      fallback: false,
      gpu: "Apple M3 Pro",
    });
    expect(readEnvironment(bare).gpu).toBe("Apple metal-3");
  });

  test("WebGPURenderer on its WebGL2 backend is a fallback unless forced", () => {
    vi.stubGlobal("WebGL2RenderingContext", FakeWebgl2);
    const gl = new FakeWebgl2(
      "ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)",
    );

    expect(readEnvironment(withBackend({ gl, isWebGLBackend: true, parameters: {} }))).toEqual({
      backend: "webgl2",
      fallback: true,
      gpu: "Apple M3 Pro",
      three: null,
    });
    expect(
      readEnvironment(withBackend({ gl, isWebGLBackend: true, parameters: { forceWebGL: true } }))
        .fallback,
    ).toBe(false);
  });

  test("WebGLRenderer reads the context; Firefox's plain RENDERER works too", () => {
    vi.stubGlobal("WebGL2RenderingContext", FakeWebgl2);

    expect(readEnvironment(withContext(new FakeWebgl2("Apple GPU")))).toMatchObject({
      backend: "webgl2",
      fallback: false,
      gpu: "Apple GPU",
    });
    expect(readEnvironment(withContext(new FakeWebgl2("Radeon R9 200 Series", false))).gpu).toBe(
      "Radeon R9 200 Series",
    );
  });

  test("a masked renderer string reads null", () => {
    vi.stubGlobal("WebGL2RenderingContext", FakeWebgl2);
    expect(readEnvironment(withContext(new FakeWebgl2("WebKit WebGL", false))).gpu).toBeNull();
  });
});

describe("PerformanceMonitor.getEnvironment", () => {
  test("re-reads until the backend settles, then caches", () => {
    const backend: { device: unknown; isWebGPUBackend: true } = {
      device: null,
      isWebGPUBackend: true,
    };
    const monitor = new PerformanceMonitor({ renderer: withBackend(backend), trackGPU: false });

    expect(monitor.getEnvironment().backend).toBeNull();

    backend.device = { adapterInfo: { description: "Apple M3 Pro" } };
    const settled = monitor.getEnvironment();
    expect(settled.backend).toBe("webgpu");

    backend.device = { adapterInfo: { description: "changed" } };
    expect(monitor.getEnvironment()).toBe(settled);
    monitor.dispose();
  });
});
