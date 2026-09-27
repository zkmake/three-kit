import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

import { PerformanceMonitor } from "../core/performance-monitor.ts";
import type { PerformanceMonitorOptions, PerfRenderer } from "../core/types.ts";
import { defaultPerfMonitorStore, type PerfMonitorStore } from "./monitor-store.ts";

type PerfSamplerProps = Omit<PerformanceMonitorOptions, "renderer"> & {
  /** Where the monitor is published for `PerfHud`. Default: the shared store. */
  store?: PerfMonitorStore;
};

/**
 * In-canvas collector. Renders nothing. Fiber runs every `useFrame` before
 * `gl.render`, so the previous frame is closed here and the next one opens, and
 * GPU queries then span the render that just ran. The monitor is created in
 * an effect so StrictMode's double mount attaches and detaches cleanly.
 */
function PerfSampler({
  frameStatsSize,
  gpuQueryPoolSize,
  historySize,
  store,
  trackGPU,
}: PerfSamplerProps) {
  const renderer = useThree((state) => state.gl);
  const monitorRef = useRef<PerformanceMonitor | null>(null);
  const startedRef = useRef(false);
  const target = store ?? defaultPerfMonitorStore;

  useEffect(() => {
    const monitor = new PerformanceMonitor({
      frameStatsSize,
      gpuQueryPoolSize,
      historySize,
      renderer: renderer as unknown as PerfRenderer,
      trackGPU,
    });
    monitorRef.current = monitor;
    startedRef.current = false;
    target.set(monitor);

    return () => {
      target.set(null);
      monitorRef.current = null;
      monitor.dispose();
    };
  }, [frameStatsSize, gpuQueryPoolSize, historySize, renderer, target, trackGPU]);

  useFrame(() => {
    const monitor = monitorRef.current;

    if (!monitor) {
      return;
    }

    if (startedRef.current) {
      monitor.end();
    }

    startedRef.current = true;
    monitor.begin();
  });

  return null;
}

export { PerfSampler };
export type { PerfSamplerProps };
