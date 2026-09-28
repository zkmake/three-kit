/**
 * The panel in the zkmake dev-panel frame (three-meter's `mountDevPanel`), so it docks, wakes,
 * dims and toggles exactly like the three-meter HUD: drag grip, expand/compact and dim-on-leave
 * discs beside a card with the brand label on top. One call for a vanilla three app: the camera
 * list, and the keyframe timeline as a second panel (docked at the bottom) on the same lab.
 */
import {
  type DefaultPlacement,
  HudTheme,
  mountDevPanel,
  type ThemeMode,
} from "@zkmake/three-meter/ui";

import {
  CameraLab,
  type CameraLabOptions,
  type SavedView,
  type TrackStore,
  type ViewStore,
} from "../core/lab.ts";
import { createCameraPanel } from "./panel.ts";
import { createTimelinePanel } from "./timeline.ts";

export type MountCameraPanelOptions = CameraLabOptions & {
  /** localStorage key prefix for the docks, compact states, saved views and tracks. `null` keeps them for this page only. Default `three-cameras`. */
  storageKey?: string | null;
  /** Where it docks on a first visit. Default the right edge, top. */
  defaultPlacement?: DefaultPlacement;
  /** The keyframe timeline panel: `false` to leave it out. Default on, docked at the bottom. */
  timeline?: boolean | { defaultPlacement?: DefaultPlacement; compact?: boolean };
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
  /** The timeline panel's frame, when mounted. */
  timeline: HTMLElement | null;
  setCompact(compact: boolean): void;
  /** `dark`, `light` or `system`: the panels follow it. */
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

/** A JSON value in localStorage under one key, with a fallback when it's missing or unreadable. */
const localJson = <T>(key: string, fallback: T, valid: (value: unknown) => boolean) => ({
  load: (): T => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "null");

      return valid(parsed) ? (parsed as T) : fallback;
    } catch {
      return fallback;
    }
  },
  save: (value: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private mode or full: it lasts this page.
    }
  },
});

const isObject = (value: unknown) => value !== null && typeof value === "object";

type Framed = {
  element: HTMLElement;
  setActive?: (active: boolean) => void;
  setTheme: (theme: "dark" | "light") => void;
};

/** One panel in a dev-panel frame, with its compact state remembered. */
const frameFor = (
  panel: Framed,
  theme: HudTheme,
  config: {
    label: string;
    className: string;
    storageKey: string | null;
    defaultPlacement: DefaultPlacement;
    compact: boolean;
    toggleLabel: string;
    detailEvent: string;
    detail: (value: unknown) => string;
    /** The detail before the panel's first event (it fired before this frame listened). */
    initial: unknown;
    container?: HTMLElement;
  },
) => {
  const compactKey = config.storageKey ? `${config.storageKey}:compact` : null;

  const setCompact = (compact: boolean) => {
    frame.element.classList.toggle("tcm-compact", compact);
    panel.setActive?.(!compact);

    if (compactKey) {
      writeFlag(compactKey, compact ? "1" : "0");
    }

    frame.refresh();
  };

  const frame = mountDevPanel({
    brand: "three-cameras",
    content: panel.element,
    defaultPlacement: config.defaultPlacement,
    label: config.label,
    onToggle: () => setCompact(!frame.element.classList.contains("tcm-compact")),
    storageKey: config.storageKey ? `${config.storageKey}:panel` : null,
    theme,
    toggleLabel: config.toggleLabel,
    ...(config.container ? { parent: config.container } : {}),
  });

  frame.element.classList.add(config.className);

  const onDetail = (event: Event) => {
    frame.detail.textContent = config.detail((event as CustomEvent).detail);
  };

  panel.element.addEventListener(config.detailEvent, onDetail);
  frame.detail.textContent = config.detail(config.initial);

  const stored = compactKey ? readFlag(compactKey) : null;

  setCompact(stored === null ? config.compact : stored === "1");

  return {
    frame,
    setCompact,
    dispose: () => {
      panel.element.removeEventListener(config.detailEvent, onDetail);
      frame.dispose();
    },
  };
};

export const mountCameraPanel = (options: MountCameraPanelOptions): CameraPanelHandle => {
  const key = options.storageKey === null ? null : (options.storageKey ?? "three-cameras");
  const store: ViewStore | undefined =
    options.store ??
    (key ? localJson<Record<string, SavedView[]>>(`${key}:views`, {}, isObject) : undefined);
  const trackStore: TrackStore | undefined =
    options.trackStore ??
    (key
      ? localJson<ReturnType<TrackStore["load"]>>(
          `${key}:tracks`,
          { tracks: {} },
          (value) => isObject(value) && isObject((value as { tracks?: unknown }).tracks),
        )
      : undefined);
  const lab = new CameraLab({
    ...options,
    ...(store ? { store } : {}),
    ...(trackStore ? { trackStore } : {}),
  });
  const theme = new HudTheme(options.theme ?? "system");
  const panel = createCameraPanel(lab);
  const list = frameFor(panel, theme, {
    label: "Cameras",
    className: "tcm-frame",
    storageKey: key,
    defaultPlacement: options.defaultPlacement ?? { edge: "right", align: "start" },
    compact: options.compact === true,
    toggleLabel: "Show or hide the camera list",
    detailEvent: "tcm-count",
    detail: (count) => `${count} camera${Number(count) === 1 ? "" : "s"}`,
    initial: Number(panel.element.dataset.count ?? 0),
    ...(options.container ? { container: options.container } : {}),
  });
  const timelineOptions = typeof options.timeline === "object" ? options.timeline : {};
  const timelinePanel = options.timeline === false ? null : createTimelinePanel(lab);
  const timeline = timelinePanel
    ? frameFor(timelinePanel, theme, {
        label: "Timeline",
        className: "tcm-timeline-frame",
        storageKey: key ? `${key}:timeline` : null,
        defaultPlacement: timelineOptions.defaultPlacement ?? { edge: "bottom", align: "center" },
        compact: timelineOptions.compact === true,
        toggleLabel: "Show or hide the timeline",
        detailEvent: "tcm-clock",
        detail: (clock) => String(clock),
        initial: `${lab.timeline().time.toFixed(2)} / ${lab.timeline().duration.toFixed(2)} s`,
        ...(options.container ? { container: options.container } : {}),
      })
    : null;

  const paintTheme = () => {
    panel.setTheme(theme.resolved);
    timelinePanel?.setTheme(theme.resolved);
  };
  const unsubscribeTheme = theme.subscribe(paintTheme);

  paintTheme();

  return {
    lab,
    element: list.frame.element,
    timeline: timeline?.frame.element ?? null,
    setCompact: list.setCompact,
    setTheme: (mode) => theme.setMode(mode),
    dispose: () => {
      unsubscribeTheme();
      theme.dispose();
      panel.dispose();
      timelinePanel?.dispose();
      list.dispose();
      timeline?.dispose();
      lab.dispose();
    },
  };
};
