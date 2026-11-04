/**
 * The meter and its HUD: the heavy half, which `mountDevTools` imports only behind the flag, so
 * three-meter lands in its own chunk of the app's bundle.
 */
import { type FrameworkVersions, PerformanceMonitor, type PerfRenderer } from "@zkmake/three-meter";
import { mountPerfHud, type MountPerfHudOptions } from "@zkmake/three-meter/ui";

const mountHud = (
  renderer: PerfRenderer,
  options: MountPerfHudOptions,
  frameworks?: FrameworkVersions,
) => {
  const monitor = new PerformanceMonitor({ renderer, ...(frameworks ? { frameworks } : {}) });
  const hud = mountPerfHud(monitor, options);

  return {
    hud,
    monitor,
    dispose: () => {
      hud.dispose();
      monitor.dispose();
    },
  };
};

export { mountHud };
