/**
 * The floating HUD: a fixed host docked to a screen edge, the metrics card
 * inside it, and three discs on the inward side (drag grip, compact/full
 * toggle, dim on leave) that stay hidden until the pointer is near or someone
 * taps. The dim disc flips `settings.dim`; the palette comes from `theme`. This is what the React
 * `PerfHud` wraps; a vanilla three app calls it directly.
 */
import type { PerformanceMonitor } from "../core/performance-monitor.ts";
import type { Budgets } from "./budgets.ts";
import { type DefaultPlacement, dockPanel } from "./dock-panel.ts";
import { DEFAULT_STORAGE_KEY, HudSettings } from "./hud-settings.ts";
import { createIcon } from "./icons.ts";
import { PerformanceView, type PerformanceViewMode } from "./performance-view.ts";
import { injectStyles } from "./styles.ts";
import { applyTheme, HudTheme, type ThemeMode } from "./theme.ts";

const TOUCH_LINGER_MS = 2500;

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

const disc = (label: string, className: string, icon: "blend" | "grip" | "sliders") => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `perf-hud__disc ${className}`.trim();
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(createIcon(icon, "perf-hud__icon"));

  return button;
};

const mountPerfHud = (
  monitor: PerformanceMonitor,
  options: MountPerfHudOptions = {},
): PerfHudHandle => {
  const storageKey = options.storageKey === undefined ? DEFAULT_STORAGE_KEY : options.storageKey;
  const settings = options.settings ?? new HudSettings({ storageKey });
  const theme = new HudTheme(options.theme ?? "system");
  const parent = options.parent ?? document.body;

  if (options.injectStyles ?? true) {
    injectStyles(parent.ownerDocument);
  }

  const host = document.createElement("div");
  host.className = "perf-hud";
  host.dataset.edge = "left";
  host.setAttribute("aria-label", options.label ?? "Performance");

  const hotspot = document.createElement("div");
  hotspot.className = "perf-hud__hotspot";
  hotspot.setAttribute("aria-hidden", "true");

  const tools = document.createElement("div");
  tools.className = "perf-hud__tools";
  const grip = disc("Drag performance panel", "perf-hud__drag", "grip");
  const toggle = disc("Toggle full performance metrics", "", "sliders");
  const dim = disc("Dim the panel when the pointer leaves", "perf-hud__dim", "blend");
  dim.addEventListener("click", () => settings.setDim(!settings.dim));
  tools.append(grip, toggle, dim);

  const view = new PerformanceView({
    budgets: options.budgets,
    mode: options.mode ?? "compact",
    monitor,
    refreshHz: options.refreshHz,
    settings,
    theme,
  });

  host.append(hotspot, tools, view.element);
  parent.append(host);

  const applyMode = () => {
    host.classList.toggle("perf-hud--full", view.getMode() === "full");
  };

  const applyDim = () => {
    host.classList.toggle("perf-hud--dim", settings.dim);
    dim.setAttribute("aria-pressed", String(settings.dim));
    dim.title = `Dim on leave: ${settings.dim ? "on" : "off"}`;
  };

  applyMode();
  applyDim();
  // After the view: constructing it restores the panel's stored theme pick.
  applyTheme(host, theme);
  const unsubscribe = settings.subscribe(applyDim);
  const unsubscribeTheme = theme.subscribe(() => applyTheme(host, theme));
  const dock = dockPanel(host, {
    defaultPlacement: options.defaultPlacement,
    handle: grip,
    storageKey,
  });

  const setMode = (mode: PerformanceViewMode) => {
    view.setMode(mode);
    applyMode();
    requestAnimationFrame(() => dock.refresh());
  };

  toggle.addEventListener("click", () => {
    setMode(view.getMode() === "compact" ? "full" : "compact");
  });

  // Wake on approach, sleep on leave; a touch lingers so the discs can be tapped.
  let hideTimer = 0;

  const sleep = () => {
    if (host.classList.contains("is-dragging")) {
      return;
    }

    host.classList.remove("is-awake");
  };

  const wake = (linger: boolean) => {
    host.classList.add("is-awake");
    window.clearTimeout(hideTimer);

    if (linger) {
      hideTimer = window.setTimeout(sleep, TOUCH_LINGER_MS);
    }
  };

  const onEnter = () => {
    wake(false);
  };

  const onLeave = (event: PointerEvent) => {
    if (host.contains(event.relatedTarget as Node | null)) {
      return;
    }

    if (event.pointerType === "touch" || event.pointerType === "pen") {
      wake(true);

      return;
    }

    sleep();
  };

  const onDown = (event: PointerEvent) => {
    wake(event.pointerType !== "mouse");
  };

  host.addEventListener("pointerenter", onEnter);
  host.addEventListener("pointerleave", onLeave);
  host.addEventListener("pointerdown", onDown);

  view.start();

  return {
    dispose: () => {
      window.clearTimeout(hideTimer);
      host.removeEventListener("pointerenter", onEnter);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
      unsubscribe();
      unsubscribeTheme();
      dock.dispose();
      view.dispose();
      theme.dispose();
      host.remove();
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
