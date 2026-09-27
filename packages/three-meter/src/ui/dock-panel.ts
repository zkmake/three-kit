/**
 * Dock a fixed-position panel to a screen edge. Dragging the handle snaps it
 * to the nearest edge on drop; the edge and the offset along it persist under
 * `<storageKey>:placement`. A stored box whose centre sits outside the current
 * viewport is re-docked to whichever edge that box is closest to.
 */
import { DEFAULT_STORAGE_KEY } from "./hud-settings.ts";

const INSET = 10;
/** Room for the stacked control discs on the inward side of the panel. */
const SIDE_CLEARANCE = 26;
const DRAG_THRESHOLD = 4;
const EDGES = ["left", "right", "top", "bottom"] as const;

type ScreenEdge = (typeof EDGES)[number];

type Placement = {
  /** Top (left/right) or left (top/bottom) of the host, in CSS pixels. */
  along: number;
  edge: ScreenEdge;
};

type Box = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type DockAlign = "start" | "center" | "end";

type DefaultPlacement = {
  edge: ScreenEdge;
  /** Where along that edge on a first visit. Default `center`. */
  align?: DockAlign;
};

type DockPanelOptions = {
  /** The drag grip. Without one the panel still docks and re-docks on resize. */
  handle?: HTMLElement | null;
  /** First-visit position, before anything is stored. Default left edge, centred. */
  defaultPlacement?: DefaultPlacement;
  /** Shares the HUD's key; `null` disables persistence. Default `three-meter`. */
  storageKey?: string | null;
};

type DockHandle = {
  /** Re-resolve against the current viewport and panel size (after a mode change, say). */
  refresh: () => Placement;
  dispose: () => void;
};

const viewportBox = (): Box => ({
  height: window.innerHeight,
  left: 0,
  top: 0,
  width: window.innerWidth,
});

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const panelBox = (element: HTMLElement): Box => {
  const rect = element.getBoundingClientRect();

  return {
    height: rect.height || element.offsetHeight,
    left: rect.left,
    top: rect.top,
    width: rect.width || element.offsetWidth,
  };
};

const clampAlong = (edge: ScreenEdge, along: number, view: Box, panel: Box) => {
  if (edge === "left" || edge === "right") {
    return clamp(along, INSET, Math.max(INSET, view.height - panel.height - INSET));
  }

  // Tools sit on the right (inward) unless the panel is on the right edge.
  return clamp(along, INSET, Math.max(INSET, view.width - panel.width - INSET - SIDE_CLEARANCE));
};

const ghostBox = (placement: Placement, panel: Box, view: Box): Box => {
  switch (placement.edge) {
    case "left":
      return { height: panel.height, left: INSET, top: placement.along, width: panel.width };
    case "right":
      return {
        height: panel.height,
        left: view.width - INSET - panel.width,
        top: placement.along,
        width: panel.width,
      };
    case "top":
      return { height: panel.height, left: placement.along, top: INSET, width: panel.width };
    case "bottom":
      return {
        height: panel.height,
        left: placement.along,
        top: view.height - INSET - panel.height,
        width: panel.width,
      };
  }
};

const centerOutside = (box: Box, view: Box) => {
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;

  return x < 0 || y < 0 || x > view.width || y > view.height;
};

const snapBoxToEdge = (box: Box, view: Box): Placement => {
  const distances: Record<ScreenEdge, number> = {
    bottom: view.height - (box.top + box.height),
    left: box.left,
    right: view.width - (box.left + box.width),
    top: box.top,
  };

  let edge: ScreenEdge = "left";
  let nearest = Number.POSITIVE_INFINITY;

  for (const next of EDGES) {
    if (distances[next] < nearest) {
      nearest = distances[next];
      edge = next;
    }
  }

  const along = edge === "left" || edge === "right" ? box.top : box.left;

  return { along: Math.round(clampAlong(edge, along, view, box)), edge };
};

const initialPlacement = (preset: DefaultPlacement, view: Box, panel: Box): Placement => {
  const { edge } = preset;
  const vertical = edge === "left" || edge === "right";
  const span = vertical ? view.height : view.width;
  const size = vertical ? panel.height : panel.width;
  const along =
    preset.align === "start" ? 0 : preset.align === "end" ? span - size : (span - size) / 2;

  return { along: Math.round(clampAlong(edge, along, view, panel)), edge };
};

const isEdge = (value: unknown): value is ScreenEdge =>
  typeof value === "string" && (EDGES as readonly string[]).includes(value);

const readPlacement = (key: string | null): Placement | null => {
  if (key === null) {
    return null;
  }

  try {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { along?: unknown; edge?: unknown };

    if (
      typeof parsed.along !== "number" ||
      !Number.isFinite(parsed.along) ||
      !isEdge(parsed.edge)
    ) {
      return null;
    }

    return { along: parsed.along, edge: parsed.edge };
  } catch {
    return null;
  }
};

const writePlacement = (key: string | null, placement: Placement) => {
  if (key === null) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(placement));
  } catch {
    // Best-effort; the live dock still applies.
  }
};

const resolvePlacement = (
  stored: Placement | null,
  preset: DefaultPlacement,
  panel: Box,
  view: Box,
): Placement => {
  if (!stored) {
    return initialPlacement(preset, view, panel);
  }

  const ghost = ghostBox(stored, panel, view);

  if (centerOutside(ghost, view)) {
    return snapBoxToEdge(ghost, view);
  }

  return {
    along: Math.round(clampAlong(stored.edge, stored.along, view, panel)),
    edge: stored.edge,
  };
};

const paintPlacement = (element: HTMLElement, placement: Placement) => {
  element.dataset.edge = placement.edge;
  element.style.left = "";
  element.style.right = "";
  element.style.top = "";
  element.style.bottom = "";
  element.style.transform = "";

  switch (placement.edge) {
    case "left":
      element.style.left = `${INSET}px`;
      element.style.top = `${placement.along}px`;
      break;
    case "right":
      element.style.right = `${INSET}px`;
      element.style.top = `${placement.along}px`;
      break;
    case "top":
      element.style.top = `${INSET}px`;
      element.style.left = `${placement.along}px`;
      break;
    case "bottom":
      element.style.bottom = `${INSET}px`;
      element.style.left = `${placement.along}px`;
      break;
  }
};

/**
 * Dock `element` from storage (or the left centre), re-dock on resize, and
 * snap to the nearest edge when the handle drops.
 */
const dockPanel = (element: HTMLElement, options: DockPanelOptions = {}): DockHandle => {
  const baseKey = options.storageKey === undefined ? DEFAULT_STORAGE_KEY : options.storageKey;
  const key = baseKey === null ? null : `${baseKey}:placement`;
  const handle = options.handle ?? null;
  const preset = options.defaultPlacement ?? { edge: "left" };

  const apply = (): Placement => {
    const stored = readPlacement(key);
    const view = viewportBox();

    if (element.classList.contains("is-dragging")) {
      return stored ?? initialPlacement(preset, view, panelBox(element));
    }

    const panel = panelBox(element);

    if (panel.width === 0 || panel.height === 0) {
      return stored ?? initialPlacement(preset, view, panel);
    }

    const next = resolvePlacement(stored, preset, panel, view);
    paintPlacement(element, next);

    if (!stored || stored.edge !== next.edge || stored.along !== next.along) {
      writePlacement(key, next);
    }

    return next;
  };

  apply();
  requestAnimationFrame(apply);

  const onResize = () => apply();
  window.addEventListener("resize", onResize);

  const resizeObserver = new ResizeObserver(() => apply());
  resizeObserver.observe(element);

  const disposeBase = () => {
    window.removeEventListener("resize", onResize);
    resizeObserver.disconnect();
  };

  if (!handle) {
    return { dispose: disposeBase, refresh: apply };
  }

  let pointerId: number | null = null;
  let originX = 0;
  let originY = 0;
  let grabX = 0;
  let grabY = 0;
  let dragging = false;

  const finish = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) {
      return;
    }

    if (dragging) {
      const next = snapBoxToEdge(panelBox(element), viewportBox());
      paintPlacement(element, next);
      writePlacement(key, next);
    }

    dragging = false;
    pointerId = null;
    element.classList.remove("is-dragging");

    try {
      handle.releasePointerCapture(event.pointerId);
    } catch {
      // Capture was never set.
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    const box = panelBox(element);
    pointerId = event.pointerId;
    originX = event.clientX;
    originY = event.clientY;
    grabX = event.clientX - box.left;
    grabY = event.clientY - box.top;
    dragging = false;
    handle.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - originX;
    const dy = event.clientY - originY;

    if (!dragging && dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) {
      return;
    }

    dragging = true;
    element.classList.add("is-dragging");
    element.style.right = "";
    element.style.bottom = "";
    element.style.transform = "";
    element.style.left = `${event.clientX - grabX}px`;
    element.style.top = `${event.clientY - grabY}px`;
  };

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);

  return {
    dispose: () => {
      disposeBase();
      handle.removeEventListener("pointerdown", onPointerDown);
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
    },
    refresh: apply,
  };
};

export { dockPanel };
export type { DefaultPlacement, DockAlign, DockHandle, DockPanelOptions, Placement, ScreenEdge };
