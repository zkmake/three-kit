/**
 * The floating HUD: the metrics card in the shared dev-panel frame
 * (`mountDevPanel`: docked host, brand label, drag / compact-full / dim discs).
 * The dim disc flips `settings.dim`; the palette comes from `theme`. This is what the React
 * `PerfHud` wraps; a vanilla three app calls it directly.
 */
import type { PerformanceMonitor } from "../core/performance-monitor.ts";
import type { Budgets } from "./budgets.ts";
import { mountDevPanel } from "./dev-panel.ts";
import type { DefaultPlacement } from "./dock-panel.ts";
import { DEFAULT_STORAGE_KEY, HudSettings } from "./hud-settings.ts";
import { PerformanceView, type PerformanceViewMode } from "./performance-view.ts";
import { HudTheme, type ThemeMode } from "./theme.ts";

type MountPerfHudOptions = {
  /** Start compact (the card) or full (the checkbox list). Default `compact`. */
  mode?: PerformanceViewMode;
  /**
   * `dark`, `light`, or `system` to follow the OS preference. Default
   * `system`. Change it later with the handle's `setTheme`. A pick made in
   * the panel's own theme row (kept in `settings`) sits on top of this.
   */
  theme?: ThemeMode;
  /** localStorage key for the selection and the dock. `null` disables persistence. */
  storageKey?: string | null;
  /** Bring your own; otherwise one is created from `storageKey`. */
  settings?: HudSettings;
  /** Where the card sits on a first visit. Default left edge, centred. */
  defaultPlacement?: DefaultPlacement;
  /** Where the host element goes. Default `document.body`. */
  parent?: HTMLElement;
  /** Append the stylesheet to the document once. Default true. */
  injectStyles?: boolean;
  /** Repaint rate. Default 10. */
  refreshHz?: number;
  /**
   * Limits past which a value turns amber, e.g. `{ calls: 500, targetFps: 120 }`.
   * Timing budgets default from `targetFps` (60); `false` turns them all off.
   * Change later with the handle's `setBudgets`.
   */
  budgets?: Budgets | false;
  /** Accessible name of the panel. Default `Performance`. */
  label?: string;
};

type PerfHudHandle = {
  element: HTMLDivElement;
  view: PerformanceView;
  settings: HudSettings;
  /**
   * `mode` is the consumer layer, `override` the panel's pick, `effective`
   * whichever applies, `resolved` the `dark` / `light` on screen. Subscribe
   * for changes, including the OS preference moving under `system`.
   */
  theme: HudTheme;
  getMode: () => PerformanceViewMode;
  setMode: (mode: PerformanceViewMode) => void;
  /** The consumer layer. The panel's pick, if any, is `settings.theme`. */
  getTheme: () => ThemeMode;
  /** Sets the consumer layer; a pick made in the panel still wins until `settings.setTheme(null)`. */
  setTheme: (mode: ThemeMode) => void;
  /** Replace the budgets; `false` turns them all off. */
  setBudgets: (budgets: Budgets | false | undefined) => void;
  dispose: () => void;
};

const mountPerfHud = (
  monitor: PerformanceMonitor,
  options: MountPerfHudOptions = {},
): PerfHudHandle => {
  const storageKey = options.storageKey === undefined ? DEFAULT_STORAGE_KEY : options.storageKey;
  const settings = options.settings ?? new HudSettings({ storageKey });
  const theme = new HudTheme(options.theme ?? "system");

  const view = new PerformanceView({
    budgets: options.budgets,
    mode: options.mode ?? "compact",
    monitor,
    refreshHz: options.refreshHz,
    settings,
    theme,
  });

  // After the view: constructing it restores the panel's stored theme pick.
  const panel = mountDevPanel({
    brand: "three-meter",
    content: view.element,
    defaultPlacement: options.defaultPlacement,
    dim: {
      get: () => settings.dim,
      set: (on) => settings.setDim(on),
      subscribe: (listener) => settings.subscribe(listener),
    },
    injectStyles: options.injectStyles,
    label: options.label ?? "Performance",
    onToggle: () => setMode(view.getMode() === "compact" ? "full" : "compact"),
    parent: options.parent,
    storageKey,
    theme,
    toggleLabel: "Toggle full performance metrics",
  });
  const host = panel.element;

  const applyMode = () => {
    host.classList.toggle("perf-hud--full", view.getMode() === "full");
  };

  const setMode = (mode: PerformanceViewMode) => {
    view.setMode(mode);
    applyMode();
    panel.refresh();
  };

  applyMode();
  view.start();

  return {
    dispose: () => {
      panel.dispose();
      view.dispose();
      theme.dispose();
    },
    element: host,
    getMode: () => view.getMode(),
    setBudgets: (budgets) => view.setBudgets(budgets),
    setMode,
    getTheme: () => theme.mode,
    setTheme: (mode: ThemeMode) => theme.setMode(mode),
    settings,
    theme,
    view,
  };
};

export { mountPerfHud };
export type { MountPerfHudOptions, PerfHudHandle };
