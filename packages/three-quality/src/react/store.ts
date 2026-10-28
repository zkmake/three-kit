/**
 * Hands the in-canvas controller to the rest of the page (a settings menu, three-meter's HUD). A
 * React context can't: R3F's `<Canvas>` is its own reconciler root. One default store; pass your
 * own to `<AdaptiveQuality>` and the hooks to run two canvases on one page.
 */
import type { AdaptiveQuality, QualityState } from "../adapt-quality.ts";

type QualityStore = {
  /** The mounted controller, or `null`: `qualityStore.get()?.pin(1)` from a settings menu. */
  get: () => AdaptiveQuality | null;
  set: (handle: AdaptiveQuality | null) => void;
  /** Called when a controller mounts or unmounts, and on each change of its state. */
  subscribe: (listener: () => void) => () => void;
  /** The mounted controller's state, `null` without one. What three-meter's HUD reads. */
  readonly state: QualityState | null;
};

const createQualityStore = (): QualityStore => {
  let current: AdaptiveQuality | null = null;
  let unwatch: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    get: () => current,
    set(handle) {
      unwatch?.();
      unwatch = handle ? handle.onChange(notify) : null;
      current = handle;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    get state() {
      return current?.state ?? null;
    },
  };
};

const qualityStore = createQualityStore();

export { createQualityStore, qualityStore };
export type { QualityStore };
