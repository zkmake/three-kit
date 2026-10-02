/**
 * The frame every zkmake dev panel shares, so they look and handle alike: a fixed host docked to a
 * screen edge, a card with a brand label on top and the panel's content under it, and three discs
 * on the inward side — drag grip, expand/compact, dim on leave — that stay hidden until the pointer
 * is near or someone taps. `mountPerfHud` is one; `@zkmake/three-textures`' panel is another.
 */
import { type DefaultPlacement, dockPanel, type ScreenEdge } from "./dock-panel.ts";
import { createIcon } from "./icons.ts";
import { injectStyles } from "./styles.ts";
import { applyTheme, type HudTheme } from "./theme.ts";

const TOUCH_LINGER_MS = 2500;

type DevPanelDim = {
  get: () => boolean;
  set: (on: boolean) => void;
  subscribe: (listener: () => void) => () => void;
};

type MountDevPanelOptions = {
  /** The panel's body, placed in the card under the brand label. */
  content: HTMLElement;
  /** The label on top of the card, naming the tool: `three-meter`, `three-textures`. */
  brand: string;
  /** Accessible name of the panel. */
  label: string;
  theme: HudTheme;
  /** Base key for the dock placement (`<key>:placement`) and the default dim flag. `null`: not kept. */
  storageKey: string | null;
  /** Where the card sits on a first visit. Default left edge, centred. */
  defaultPlacement?: DefaultPlacement;
  /** Where the host goes. Default `document.body`. */
  parent?: HTMLElement;
  /** Append the stylesheet to the document once. Default true. */
  injectStyles?: boolean;
  /** The expand/compact disc: its label, and what a press does. */
  onToggle: () => void;
  toggleLabel?: string;
  /** Where dim-on-leave lives. Default a flag of its own under `<storageKey>:dim`, off. */
  dim?: DevPanelDim;
  /** The panel docked to another edge (a drop or a resize). */
  onEdgeChange?: (edge: ScreenEdge) => void;
};

type DevPanelHandle = {
  element: HTMLDivElement;
  card: HTMLDivElement;
  /** The brand row's right-hand slot: a count, a status. */
  detail: HTMLSpanElement;
  /** Re-dock against the current size, after the card grows or shrinks. */
  refresh: () => void;
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

/** A dim flag in localStorage, for panels with no settings of their own. */
const storedDim = (key: string | null): DevPanelDim => {
  const listeners = new Set<() => void>();
  let on = false;

  try {
    on = key !== null && localStorage.getItem(key) === "1";
  } catch {
    // No storage (private mode): the flag lasts this page.
  }

  return {
    get: () => on,
    set: (next) => {
      on = next;

      try {
        if (key !== null) {
          localStorage.setItem(key, next ? "1" : "0");
        }
      } catch {
        // As above.
      }

      for (const listener of listeners) {
        listener();
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

const mountDevPanel = (options: MountDevPanelOptions): DevPanelHandle => {
  const parent = options.parent ?? document.body;
  const dim =
    options.dim ?? storedDim(options.storageKey === null ? null : `${options.storageKey}:dim`);

  if (options.injectStyles ?? true) {
    injectStyles(parent.ownerDocument);
  }

  const host = document.createElement("div");
  host.className = "perf-hud";
  host.dataset.edge = "left";
  // A named group: an aria-label on a plain div is dropped by screen readers.
  host.setAttribute("role", "group");
  host.setAttribute("aria-label", options.label);

  const hotspot = document.createElement("div");
  hotspot.className = "perf-hud__hotspot";
  hotspot.setAttribute("aria-hidden", "true");

  const tools = document.createElement("div");
  tools.className = "perf-hud__tools";
  const grip = disc(`Drag the ${options.brand} panel`, "perf-hud__drag", "grip");
  const toggle = disc(options.toggleLabel ?? "Expand or compact the panel", "", "sliders");
  const dimDisc = disc("Dim the panel when the pointer leaves", "perf-hud__dim", "blend");
  dimDisc.addEventListener("click", () => dim.set(!dim.get()));
  toggle.addEventListener("click", () => options.onToggle());
  tools.append(grip, toggle, dimDisc);

  const card = document.createElement("div");
  card.className = "perf-hud__card";

  const brand = document.createElement("div");
  brand.className = "perf-hud__brand";

  const name = document.createElement("span");
  name.className = "perf-hud__brand-name";
  name.textContent = options.brand;

  const detail = document.createElement("span");
  detail.className = "perf-hud__brand-detail";
  brand.append(name, detail);
  card.append(brand, options.content);

  host.append(hotspot, tools, card);
  parent.append(host);

  const applyDim = () => {
    host.classList.toggle("perf-hud--dim", dim.get());
    dimDisc.setAttribute("aria-pressed", String(dim.get()));
    dimDisc.title = `Dim on leave: ${dim.get() ? "on" : "off"}`;
  };

  applyDim();
  applyTheme(host, options.theme);
  const unsubscribeDim = dim.subscribe(applyDim);
  const unsubscribeTheme = options.theme.subscribe(() => applyTheme(host, options.theme));
  const dock = dockPanel(host, {
    defaultPlacement: options.defaultPlacement,
    handle: grip,
    storageKey: options.storageKey,
  });

  // `dockPanel` writes the edge onto `data-edge`; pass changes on.
  let edge = host.dataset.edge as ScreenEdge;
  const edgeWatch = new MutationObserver(() => {
    const next = host.dataset.edge as ScreenEdge;

    if (next !== edge) {
      edge = next;
      options.onEdgeChange?.(edge);
    }
  });

  edgeWatch.observe(host, { attributes: true, attributeFilter: ["data-edge"] });
  options.onEdgeChange?.(edge);

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

  return {
    element: host,
    card,
    detail,
    refresh: () => {
      requestAnimationFrame(() => dock.refresh());
    },
    dispose: () => {
      window.clearTimeout(hideTimer);
      edgeWatch.disconnect();
      host.removeEventListener("pointerenter", onEnter);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
      unsubscribeDim();
      unsubscribeTheme();
      dock.dispose();
      host.remove();
    },
  };
};

export { mountDevPanel };
export type { DevPanelDim, DevPanelHandle, MountDevPanelOptions };
