/**
 * A library's demo page: one scene, two integrations (plain three and React Three Fiber) swapped
 * in place from the header's `#demo` switch. Both mount into `#stage`; `?r3f` opens on Fiber. The
 * header's theme sets the page and the demo's panels together.
 */
import type { ThemeMode } from "@zkmake/three-meter/ui";

import { startInstall } from "./install.ts";
import { BACKGROUNDS, startTheme } from "./theme.ts";

type DemoKind = "vanilla" | "r3f";

/** What every integration hands back, so the page can restyle and swap it. */
type Demo = {
  setBackground: (hex: string) => void;
  setTheme: (mode: ThemeMode) => void;
  dispose: () => void;
};

/** The page's part of a demo's options; each library's demo adds its own. */
type DemoBase = {
  /** Scene background, as a CSS hex colour. Follows the page theme. */
  background: string;
  /** The panels' consumer theme layer. */
  theme: ThemeMode;
};

type Mount = (host: HTMLElement, base: DemoBase) => Promise<Demo>;

type DemoPageOptions = {
  /** Loads an integration: a dynamic import, so each page fetches only the one it shows. */
  load: Record<DemoKind, () => Promise<Mount>>;
  /** The install card's "then …" line for each integration. */
  usage: Record<DemoKind, string>;
  /** The header note for each integration, as HTML. */
  note: (kind: DemoKind) => string;
};

const isDemoKind = (value: unknown): value is DemoKind => value === "vanilla" || value === "r3f";

/** Same page with one flag flipped; the other params ride along. Flags stay bare (`?r3f`, not `?r3f=`). */
const hrefWith = (edit: (next: URLSearchParams) => void) => {
  const next = new URLSearchParams(location.search);

  edit(next);

  const query = [...next]
    .map(([key, value]) =>
      value === ""
        ? encodeURIComponent(key)
        : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");

  return query ? `?${query}` : location.pathname;
};

const startDemoPage = ({ load, usage, note }: DemoPageOptions) => {
  const stage = document.querySelector<HTMLElement>("#stage")!;
  const noteEl = document.querySelector("#note");
  const usageEl = document.querySelector("#install-usage");
  const demoButtons = [...document.querySelectorAll<HTMLButtonElement>("#demo [data-demo]")];
  let demoKind: DemoKind = new URLSearchParams(location.search).has("r3f") ? "r3f" : "vanilla";

  // `token` guards against a slow load (WebGPU init, textures) landing after a switch.
  let demo: Demo | null = null;
  let token = 0;

  const pageTheme = startTheme((mode) => demo?.setTheme(mode));

  pageTheme.subscribe(() => demo?.setBackground(BACKGROUNDS[pageTheme.resolved]));

  const loadDemo = async (kind: DemoKind) => {
    const mine = ++token;

    demo?.dispose();
    demo = null;
    stage.replaceChildren();

    const mount = await load[kind]();

    if (mine !== token) {
      return;
    }

    const next = await mount(stage, {
      background: BACKGROUNDS[pageTheme.resolved],
      theme: pageTheme.mode,
    });

    if (mine !== token) {
      next.dispose();

      return;
    }

    demo = next;
  };

  const paint = () => {
    if (usageEl) {
      usageEl.textContent = usage[demoKind];
    }

    if (noteEl) {
      noteEl.innerHTML = note(demoKind);
    }

    for (const button of demoButtons) {
      button.setAttribute("aria-checked", String(button.dataset.demo === demoKind));
    }
  };

  for (const button of demoButtons) {
    button.addEventListener("click", () => {
      const kind = button.dataset.demo;

      if (!isDemoKind(kind) || kind === demoKind) {
        return;
      }

      demoKind = kind;
      history.replaceState(
        null,
        "",
        hrefWith((q) => (kind === "r3f" ? q.set("r3f", "") : q.delete("r3f"))),
      );
      paint();
      void loadDemo(kind);
    });
  }

  startInstall();
  paint();
  void loadDemo(demoKind);
};

export { hrefWith, startDemoPage };
export type { Demo, DemoBase, DemoKind, Mount };
