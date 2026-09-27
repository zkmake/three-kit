/**
 * `@zkmake/three-meter/react`: the React Three Fiber pair. `PerfSampler`
 * goes inside `<Canvas>` and brackets frames; `PerfHud` goes outside it and
 * draws the dockable card. Peer deps: `react`, `@react-three/fiber`.
 */

export { createPerfMonitorStore, defaultPerfMonitorStore } from "./monitor-store.ts";
export { PerfHud } from "./perf-hud.tsx";
export { PerfSampler } from "./perf-sampler.tsx";
export type { PerfMonitorStore } from "./monitor-store.ts";
export type { PerfHudProps } from "./perf-hud.tsx";
export type { PerfSamplerProps } from "./perf-sampler.tsx";
