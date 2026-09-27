import { useEffect, useRef } from "react";

import type { Budgets } from "../ui/budgets.ts";
import {
  mountPerfHud,
  type MountPerfHudOptions,
  type PerfHudHandle,
} from "../ui/mount-perf-hud.ts";
import { defaultPerfMonitorStore, type PerfMonitorStore } from "./monitor-store.ts";

type PerfHudProps = Omit<MountPerfHudOptions, "settings"> & {
  /** Must match the `PerfSampler`'s. Default: the shared store. */
  store?: PerfMonitorStore;
};

/**
 * DOM overlay. Render it *outside* `<Canvas>`, or Fiber would treat its markup
 * as three objects. Mounts the dockable HUD whenever a `PerfSampler` has
 * published a monitor and tears it down when that sampler unmounts.
 *
 * `theme`, `mode`, `label` and `budgets` apply live through the handle.
 * `defaultPlacement` and `budgets` are compared by value, so inline literals
 * like `{{ edge: "right" }}` are fine.
 * The remaining props (`storageKey`, `parent`, `refreshHz`, `injectStyles`,
 * `store`) remount the HUD when they change.
 */
function PerfHud({
  budgets,
  defaultPlacement,
  injectStyles,
  label,
  mode,
  parent,
  refreshHz,
  storageKey,
  store,
  theme,
}: PerfHudProps) {
  const source = store ?? defaultPerfMonitorStore;
  const handleRef = useRef<PerfHudHandle | null>(null);
  // The mount effect reads these through refs so changing them never remounts;
  // the live effects below keep the refs current and push changes to the handle.
  const themeRef = useRef(theme);
  const modeRef = useRef(mode);
  const labelRef = useRef(label);
  const budgetsRef = useRef(budgets);
  // By value: an inline `{{ calls: 500 }}` is a new object every render.
  const budgetsKey = JSON.stringify(budgets ?? null);
  // Primitives, so an inline `{{ edge: "right" }}` literal doesn't remount each render.
  const placementEdge = defaultPlacement?.edge;
  const placementAlign = defaultPlacement?.align;

  useEffect(() => {
    const attach = (monitor: ReturnType<PerfMonitorStore["get"]>) => {
      handleRef.current?.dispose();
      handleRef.current = null;

      if (!monitor) {
        return;
      }

      handleRef.current = mountPerfHud(monitor, {
        budgets: budgetsRef.current,
        defaultPlacement: placementEdge
          ? { align: placementAlign, edge: placementEdge }
          : undefined,
        injectStyles,
        label: labelRef.current,
        mode: modeRef.current,
        parent,
        refreshHz,
        storageKey,
        theme: themeRef.current,
      });
    };

    const unsubscribe = source.subscribe(attach);
    attach(source.get());

    return () => {
      unsubscribe();
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [injectStyles, parent, placementAlign, placementEdge, refreshHz, source, storageKey]);

  useEffect(() => {
    themeRef.current = theme;
    handleRef.current?.setTheme(theme ?? "system");
  }, [theme]);

  useEffect(() => {
    modeRef.current = mode;
    handleRef.current?.setMode(mode ?? "compact");
  }, [mode]);

  useEffect(() => {
    // Read back from the key so the effect depends on the value, not the object.
    const next = (JSON.parse(budgetsKey) as Budgets | false | null) ?? undefined;
    budgetsRef.current = next;
    handleRef.current?.setBudgets(next);
  }, [budgetsKey]);

  useEffect(() => {
    labelRef.current = label;
    handleRef.current?.element.setAttribute("aria-label", label ?? "Performance");
  }, [label]);

  return null;
}

export { PerfHud };
export type { PerfHudProps };
