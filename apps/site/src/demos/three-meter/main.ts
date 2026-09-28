/**
 * three-meter's demo page. `?webgpu` swaps in `WebGPURenderer`, `?count=5000` scales the scene;
 * both integrations share one HUD storage key, so the dock and the metric selection carry across
 * the switch.
 */
import { hrefWith, type Mount, startDemoPage } from "../../scripts/demo-page.ts";
import type { DemoFactory } from "./demo.ts";

const params = new URLSearchParams(location.search);
const webgpu = params.has("webgpu");
const count = Math.max(1, Number(params.get("count") ?? 2000));

const mount =
  (factory: DemoFactory): Mount =>
  (host, base) =>
    factory(host, { ...base, count, storageKey: "three-kit:three-meter", webgpu });

startDemoPage({
  load: {
    r3f: async () => mount((await import("./r3f.tsx")).createR3fDemo),
    vanilla: async () => mount((await import("./vanilla.ts")).createVanillaDemo),
  },
  usage: { r3f: "<PerfSampler /> + <PerfHud />", vanilla: "mountPerfHud(monitor)" },
  note: (kind) => {
    const backend = webgpu
      ? `WebGPU · <a href="${hrefWith((q) => q.delete("webgpu"))}">switch to WebGL</a>`
      : `WebGL · <a href="${hrefWith((q) => q.set("webgpu", ""))}">switch to WebGPU</a>`;

    return kind === "r3f" ? `${backend} · <b>p</b> toggles the sampler` : backend;
  },
});
