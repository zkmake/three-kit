import { describe, expect, test } from "vitest";

import { version } from "../../package.json";
import type { Sample } from "../core/types.ts";
import { renderReport } from "./report.ts";

const sample: Sample = {
  cpu: 0.24,
  fps: 119.6,
  gpu: { available: true, ms: 0.71 },
  render: { calls: 12, lines: 0, passes: 2, points: 0, triangles: 240_000 },
  resources: { geometries: 3, programs: 4, textures: 5 },
};

describe("renderReport", () => {
  test("fenced text block with versions, frame stats, counts and the page", () => {
    const report = renderReport({
      environment: { backend: "webgl2", fallback: true, gpu: "Apple M4 Max", three: "186" },
      page: { dpr: 2, height: 720, userAgent: "TestAgent/1.0", width: 1280 },
      sample,
      stats: { frames: 1000, hitches: 3, lowFps: 97.6, p99Ms: 10.24 },
    });

    expect(report.split("\n")).toEqual([
      "```text",
      `three-meter v${version} · three r186 · WebGL2 fallback · Apple M4 Max`,
      "FPS 120 · 1% low 98 · p99 10.2 ms · hitches 3 / 1,000 frames",
      "CPU 0.2 ms · GPU 0.7 ms",
      "Calls 12 · passes 2 · triangles 240K · lines 0 · points 0",
      "Geometries 3 · textures 5 · shaders 4",
      "Viewport 1280×720 @2x",
      "TestAgent/1.0",
      "```",
    ]);
  });

  test("lists the top three meshes when the scene cost is known", () => {
    const entry = (label: string, calls: number, triangles: number, instances = 1) => ({
      calls,
      instances,
      label,
      objects: [],
      triangles,
    });
    const report = renderReport({
      cost: {
        calls: 503,
        materials: [],
        meshes: [
          entry("tree", 500, 6000, 500),
          entry("cubes", 1, 24_000, 2000),
          entry("ground", 1, 2),
          entry("sky", 1, 80),
        ],
        triangles: 30_082,
      },
      environment: { backend: "webgl2", fallback: false, gpu: null, three: "186" },
      page: null,
      sample,
      stats: { frames: 0, hitches: 0, lowFps: 0, p99Ms: 0 },
    });

    expect(report).toContain(
      "Top: tree ×500 (500 calls, 6,000 tris) · cubes ×2,000 (1 call, 24,000 tris) · ground (1 call, 2 tris)\n```",
    );
  });

  test("leaves out what isn't known yet", () => {
    const report = renderReport({
      environment: { backend: null, fallback: false, gpu: null, three: null },
      page: null,
      sample: { ...sample, gpu: { available: false, ms: 0 } },
      stats: { frames: 0, hitches: 0, lowFps: 0, p99Ms: 0 },
    });

    expect(report).toContain(`three-meter v${version}\nFPS 120\nCPU 0.2 ms · GPU unavailable`);
    expect(report).not.toContain("Viewport");
  });
});
