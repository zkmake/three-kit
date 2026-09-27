/**
 * Hands the in-canvas monitor to the DOM-side HUD. A React context can't do
 * it: R3F's `<Canvas>` is its own reconciler root, so a provider outside it
 * isn't visible inside without a bridge. A tiny external store crosses that
 * boundary for free. One default store; pass your own to both components to
 * run two canvases on one page.
 */
import type { PerformanceMonitor } from "../core/performance-monitor.ts";

type MonitorListener = (monitor: PerformanceMonitor | null) => void;

type PerfMonitorStore = {
  get: () => PerformanceMonitor | null;
  set: (monitor: PerformanceMonitor | null) => void;
  subscribe: (listener: MonitorListener) => () => void;
};

const createPerfMonitorStore = (): PerfMonitorStore => {
  let current: PerformanceMonitor | null = null;
  const listeners = new Set<MonitorListener>();

  return {
    get: () => current,
    set: (monitor) => {
      current = monitor;

      for (const listener of listeners) {
        listener(monitor);
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};

const defaultPerfMonitorStore = createPerfMonitorStore();

export { createPerfMonitorStore, defaultPerfMonitorStore };
export type { PerfMonitorStore };
