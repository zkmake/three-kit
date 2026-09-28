/**
 * The panel in the zkmake dev-panel frame (three-meter's `mountDevPanel`), so it docks, wakes,
 * dims and toggles exactly like the three-meter HUD: drag grip, expand/compact and dim-on-leave
 * discs beside a card with the brand label on top. One call for a vanilla three app.
 */
import {
  type DefaultPlacement,
  HudTheme,
  mountDevPanel,
  type ThemeMode,
} from "@zkmake/three-meter/ui";

import { CameraLab, type CameraLabOptions, type SavedView, type ViewStore } from "../core/lab.ts";
import { createCameraPanel } from "./panel.ts";

export type MountCameraPanelOptions = CameraLabOptions & {
  /** localStorage key prefix for the dock, compact state and saved views. `null` keeps them for this page only. Default `three-cameras`. */
  storageKey?: string | null;
  /** Where it docks on a first visit. Default the right edge, top. */
  defaultPlacement?: DefaultPlacement;
  /** `dark`, `light` or `system` (default). */
  theme?: ThemeMode;
  /** Start compact: the brand row and the count. The choice is remembered. */
  compact?: boolean;
  /** Where to mount. Default `document.body`. */
  container?: HTMLElement;
};

export type CameraPanelHandle = {
  lab: CameraLab;
  element: HTMLElement;
  setCompact(compact: boolean): void;
  /** `dark`, `light` or `system`: the panel follows it. */
  setTheme(mode: ThemeMode): void;
  dispose(): void;
};

const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeFlag = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: the choice lasts this page.
  }
};

/** Saved views in localStorage, as JSON under one key. */
const localViews = (key: string): ViewStore => ({
  load: () => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");

      return parsed && typeof parsed === "object" ? (parsed as Record<string, SavedView[]>) : {};
    } catch {
      return {};
    }
  },
  save: (views) => {
    try {
      localStorage.setItem(key, JSON.stringify(views));
    } catch {
      // Private mode or full: the views last this page.
    }
  },
});

export const mountCameraPanel = (options: MountCameraPanelOptions): CameraPanelHandle => {
  const key = options.storageKey === null ? null : (options.storageKey ?? "three-cameras");
  const store = options.store ?? (key ? localViews(`${key}:views`) : undefined);
  const lab = new CameraLab({ ...options, ...(store ? { store } : {}) });
  const panel = createCameraPanel(lab);
  const theme = new HudTheme(options.theme ?? "system");
  const compactKey = key ? `${key}:compact` : null;

  const setCompact = (compact: boolean) => {
    frame.element.classList.toggle("tcm-compact", compact);
    panel.setActive(!compact);

    if (compactKey) {
      writeFlag(compactKey, compact ? "1" : "0");
    }

    frame.refresh();
  };

  const frame = mountDevPanel({
    brand: "three-cameras",
    content: panel.element,
    defaultPlacement: options.defaultPlacement ?? { edge: "right", align: "start" },
    label: "Cameras",
    onToggle: () => setCompact(!frame.element.classList.contains("tcm-compact")),
    storageKey: key ? `${key}:panel` : null,
    theme,
    toggleLabel: "Show or hide the camera list",
    ...(options.container ? { parent: options.container } : {}),
  });

  frame.element.classList.add("tcm-frame");

  const paintTheme = () => panel.setTheme(theme.resolved);
  const unsubscribeTheme = theme.subscribe(paintTheme);
  const showCount = (count: number) => {
    frame.detail.textContent = `${count} camera${count === 1 ? "" : "s"}`;
  };
  const onCount = (event: Event) => showCount((event as CustomEvent<number>).detail);

  paintTheme();
  panel.element.addEventListener("tcm-count", onCount);
  showCount(Number(panel.element.dataset.count ?? 0));

  const stored = compactKey ? readFlag(compactKey) : null;

  setCompact(stored === null ? options.compact === true : stored === "1");

  return {
    lab,
    element: frame.element,
    setCompact,
    setTheme: (mode) => theme.setMode(mode),
    dispose: () => {
      unsubscribeTheme();
      theme.dispose();
      panel.element.removeEventListener("tcm-count", onCount);
      panel.dispose();
      frame.dispose();
      lab.dispose();
    },
  };
};
