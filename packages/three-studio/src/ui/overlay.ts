import { type StudioState, studioHref, titleOf } from "../core/state.ts";
import { injectStyles } from "./styles.ts";

export type StudioOverlayOptions = {
  state: StudioState;
  /** Default `document.body`. */
  container?: HTMLElement | undefined;
  /**
   * Switches the view in place when a view chip is clicked (no reload). Without it the chips are
   * plain links. Area and variant chips always load their link, since they mount other things.
   */
  onView?: ((name: string) => void) | undefined;
  /** Default true. */
  injectStyles?: boolean | undefined;
};

export type StudioOverlay = {
  element: HTMLElement;
  /** The readout line, e.g. `formatStats(frameStats(renderer))`. */
  setStats: (text: string) => void;
  /** Marks a view chip current, after a switch made from code. */
  setView: (name: string) => void;
  dispose: () => void;
};

const chip = (text: string, href: string, current: boolean) => {
  const link = document.createElement("a");

  link.className = "tks__chip";
  link.href = href;
  link.textContent = text;
  link.setAttribute("aria-current", String(current));

  return link;
};

const row = (label: string, kind: string, links: HTMLAnchorElement[]) => {
  const nav = document.createElement("nav");

  nav.className = `tks__row tks__row--${kind}`;
  nav.setAttribute("aria-label", label);
  nav.append(...links);

  return nav;
};

/**
 * The switchers over the canvas: areas and variants top left with the readout under them, views
 * top right. Rows with one entry are left out. Nothing shows under `?clean=1`. The overlay is DOM,
 * so `saveShot` never captures it.
 */
export function mountStudioOverlay(options: StudioOverlayOptions): StudioOverlay {
  const { state, onView } = options;
  const container = options.container ?? document.body;

  if (options.injectStyles !== false) {
    injectStyles(container.ownerDocument);
  }

  const element = document.createElement("div");

  element.className = "tks";
  element.dataset.studio = state.tag;
  element.hidden = state.clean;

  const start = document.createElement("div");
  const end = document.createElement("div");
  const stats = document.createElement("div");

  start.className = "tks__col tks__col--start";
  end.className = "tks__col tks__col--end";
  stats.className = "tks__stats";
  stats.setAttribute("aria-live", "off");

  const areas = Object.entries(state.config.areas);
  const variants = Object.entries(state.area.variants);

  if (areas.length > 1) {
    start.append(
      row(
        "Areas",
        "areas",
        areas.map(([name, area]) =>
          chip(titleOf(name, area), studioHref(state, { area: name }), name === state.areaName),
        ),
      ),
    );
  }

  if (variants.length > 1) {
    start.append(
      row(
        "Variants",
        "variants",
        variants.map(([name, variant]) =>
          chip(
            titleOf(name, variant),
            studioHref(state, { variant: name }),
            name === state.variantName,
          ),
        ),
      ),
    );
  }

  start.append(stats);

  const viewLinks = Object.keys(state.views).map((name) => {
    const link = chip(name, studioHref(state, { view: name }), name === state.viewName);

    link.dataset.view = name;

    if (onView) {
      link.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
          return;
        }

        event.preventDefault();
        onView(name);
      });
    }

    return link;
  });

  if (viewLinks.length > 1) {
    end.append(row("Views", "views", viewLinks));
  }

  element.append(start, end);
  container.append(element);

  return {
    element,
    setStats: (text) => {
      if (stats.textContent !== text) {
        stats.textContent = text;
      }
    },
    setView: (name) => {
      for (const link of viewLinks) {
        link.setAttribute("aria-current", String(link.dataset.view === name));
      }
    },
    dispose: () => element.remove(),
  };
}
