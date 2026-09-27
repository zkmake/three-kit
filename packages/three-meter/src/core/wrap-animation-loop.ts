import type { PerformanceMonitor } from "./performance-monitor.ts";

type AnimationLoop<Args extends unknown[]> = (...args: Args) => void;

/**
 * Wrap a `renderer.setAnimationLoop` callback so each tick is one frame:
 * `begin()` before your code, `end()` after it returns. CPU time is your
 * update code plus the render dispatch; FPS comes from the interval between
 * ticks. `end()` runs even if the loop throws, so a bad frame can't leave the
 * monitor open.
 *
 * ```ts
 * renderer.setAnimationLoop(wrapAnimationLoop(monitor, (time) => { … renderer.render(scene, camera); }));
 * ```
 */
function wrapAnimationLoop<Args extends unknown[]>(
  monitor: PerformanceMonitor,
  loop: AnimationLoop<Args>,
): AnimationLoop<Args> {
  return (...args) => {
    monitor.begin();

    try {
      loop(...args);
    } finally {
      monitor.end();
    }
  };
}

export { wrapAnimationLoop };
