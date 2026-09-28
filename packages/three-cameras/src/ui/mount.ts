/**
 * The panel in the zkmake dev-panel frame (three-meter's `mountDevPanel`), so it docks, wakes,
 * dims and toggles exactly like the three-meter HUD: drag grip, expand/compact and dim-on-leave
 * discs beside a card with the brand label on top. One call for a vanilla three app.
 *
 * With the timeline (the default) it's one full-width panel anchored to the bottom of the screen:
 * the camera list as the timeline's left sidebar, each camera's row beside its lane. Without the
 * timeline, it's the camera list, docked and draggable like the other dev panels. Collapsed, either
 * is a small widget with the picked camera (else the one looked through, else a live one); a click
 * on it expands the panel again.
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
import { createCameraPanel, KIND_ICONS, svg } from "./panel.ts";
import { createTimelinePanel } from "./timeline.ts";

export type MountCameraPanelOptions = CameraLabOptions & {
  /** localStorage key prefix for the dock, compact state, saved views and tracks. `null` keeps them for this page only. Default `three-cameras`. */
  storageKey?: string | null;
  /** Where the camera list docks on a first visit, without the timeline. Default the right edge, top. With the timeline, the panel spans the bottom of the screen. */
  defaultPlacement?: DefaultPlacement;
  /** The keyframe timeline, with the camera list as its sidebar: `false` for the list alone. Default on. */
  timeline?: boolean;
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
  const withTimeline = options.timeline !== false;
  const panel = createCameraPanel(lab, { paths: withTimeline });
  const timeline = withTimeline ? createTimelinePanel(lab, { sidebar: panel }) : null;
  const content = document.createElement("div");
  const mini = document.createElement("button");

  content.className = "tcm-shell";
  mini.type = "button";
  mini.className = "tcm tcm-mini";
  content.append(mini, timeline?.element ?? panel.element);

  const compactKey = key ? `${key}:compact` : null;
  let count = Number(panel.element.dataset.count ?? 0);
  let clock = timeline
    ? `${lab.timeline().time.toFixed(2)} / ${lab.timeline().duration.toFixed(2)} s`
    : "";

  const paintDetail = () => {
    const cameras = `${count} camera${count === 1 ? "" : "s"}`;

    frame.detail.textContent = clock ? `${cameras} · ${clock}` : cameras;
  };

  const escape = (text: string) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

  /** The collapsed widget: the picked camera, else the one looked through, else a live one. */
  const paintMini = () => {
    if (!frame.element.classList.contains("tcm-compact")) {
      return;
    }

    const entries = lab.entries();
    const shown =
      entries.find((entry) => entry.selected) ??
      entries.find((entry) => entry.viewing) ??
      entries.find((entry) => entry.live) ??
      entries[0];
    const state = lab.timeline();

    mini.classList.toggle("is-live", Boolean(shown?.live));
    mini.classList.toggle("is-viewing", Boolean(shown?.viewing));
    mini.title = shown ? `${shown.id}: expand the panel` : "Expand the panel";
    mini.setAttribute("aria-label", mini.title);
    mini.innerHTML = shown
      ? `<span class="tcm-mini-kind">${svg(KIND_ICONS[shown.kind])}</span><span class="tcm-mini-name">${escape(shown.id)}</span><span class="tcm-badge${shown.viewing ? " is-viewing" : shown.live ? " is-live" : ""}">${shown.viewing ? "viewing" : shown.live ? `${shown.fps} fps` : ""}</span>${timeline && state.playing ? `<span class="tcm-mini-clock">${state.time.toFixed(1)} s</span>` : ""}`
      : `<span class="tcm-mini-name">no cameras yet</span>`;
  };

  let miniTimer: ReturnType<typeof setInterval> | null = null;

  const setCompact = (compact: boolean) => {
    frame.element.classList.toggle("tcm-compact", compact);
    // Collapsed, the list stops its own ticks; the widget keeps a slower one for its badge.
    panel.setActive(!compact);

    if (compact && !miniTimer) {
      miniTimer = setInterval(paintMini, 500);
    } else if (!compact && miniTimer) {
      clearInterval(miniTimer);
      miniTimer = null;
    }

    paintMini();

    if (compactKey) {
      writeFlag(compactKey, compact ? "1" : "0");
    }

    frame.refresh();
  };

  const frame = mountDevPanel({
    brand: "three-cameras",
    content,
    // With the timeline: across the bottom, and it stays there (styles.ts hides the drag grip).
    defaultPlacement: timeline
      ? { edge: "bottom", align: "start" }
      : (options.defaultPlacement ?? { edge: "right", align: "start" }),
    label: "Cameras",
    onToggle: () => setCompact(!frame.element.classList.contains("tcm-compact")),
    storageKey: key ? `${key}:${timeline ? "dock" : "panel"}` : null,
    theme,
    toggleLabel: "Collapse or expand the panel",
    ...(options.container ? { parent: options.container } : {}),
  });

  frame.element.classList.add("tcm-frame");

  if (timeline) {
    frame.element.classList.add("tcm-combined-frame");
  }

  mini.addEventListener("click", () => setCompact(false));

  const unsubscribeMini = lab.subscribe(paintMini);
  const onCount = (event: Event) => {
    count = Number((event as CustomEvent).detail);
    paintDetail();
  };
  const onClock = (event: Event) => {
    clock = String((event as CustomEvent).detail);
    paintDetail();
  };

  panel.element.addEventListener("tcm-count", onCount);
  timeline?.element.addEventListener("tcm-clock", onClock);
  paintDetail();

  const stored = compactKey ? readFlag(compactKey) : null;

  setCompact(stored === null ? options.compact === true : stored === "1");

  const paintTheme = () => {
    panel.setTheme(theme.resolved);
    timeline?.setTheme(theme.resolved);
  };
  const unsubscribeTheme = theme.subscribe(paintTheme);

  paintTheme();

  return {
    lab,
    element: frame.element,
    setCompact,
    setTheme: (mode) => theme.setMode(mode),
    dispose: () => {
      if (miniTimer) {
        clearInterval(miniTimer);
      }

      unsubscribeMini();
      unsubscribeTheme();
      theme.dispose();
      panel.element.removeEventListener("tcm-count", onCount);
      timeline?.element.removeEventListener("tcm-clock", onClock);
      panel.dispose();
      timeline?.dispose();
      frame.dispose();
      lab.dispose();
    },
  };
};
