/**
 * The panel in the zkmake dev-panel frame (three-meter's `mountDevPanel`), so it docks, wakes,
 * dims and toggles exactly like the three-meter HUD: drag grip, expand/compact and dim-on-leave
 * discs beside a card with the brand label on top. One call for a vanilla three app.
 */
import {
  type DefaultPlacement,
  HudTheme,
  mountDevPanel,
  type ScreenEdge,
  type ThemeMode,
} from "@zkmake/three-meter/ui";

import { TextureLab, type TextureLabOptions } from "../core/lab.ts";
import { createTexturePanel } from "./panel.ts";

export type MountTexturePanelOptions = TextureLabOptions & {
  /** Where it docks on a first visit. Default the right edge, top. */
  defaultPlacement?: DefaultPlacement;
  /** `dark`, `light` or `system` (default). */
  theme?: ThemeMode;
  /** Start compact: the brand row and the count. The choice is remembered. */
  compact?: boolean;
  /** Where to mount. Default `document.body`. */
  container?: HTMLElement;
};

export type TexturePanelHandle = {
  lab: TextureLab;
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

export const mountTexturePanel = (options: MountTexturePanelOptions): TexturePanelHandle => {
  const lab = new TextureLab(options);
  const panel = createTexturePanel(lab);
  const key = options.storageKey === null ? null : (options.storageKey ?? "three-textures");
  const theme = new HudTheme(options.theme ?? "system");
  const compactKey = key ? `${key}:compact` : null;

  const setCompact = (compact: boolean) => {
    frame.element.classList.toggle("ttx-compact", compact);
    panel.setActive(!compact);

    if (compactKey) {
      writeFlag(compactKey, compact ? "1" : "0");
    }

    frame.refresh();
  };

  const frame = mountDevPanel({
    brand: "three-textures",
    content: panel.element,
    defaultPlacement: options.defaultPlacement ?? { edge: "right", align: "start" },
    label: "Textures",
    onEdgeChange: (edge: ScreenEdge) => panel.setEdge(edge),
    onToggle: () => setCompact(!frame.element.classList.contains("ttx-compact")),
    storageKey: key ? `${key}:panel` : null,
    theme,
    toggleLabel: "Show or hide the texture list",
    ...(options.container ? { parent: options.container } : {}),
  });

  frame.element.classList.add("ttx-frame");

  // The preview lives outside the card, in the page: it takes the theme on its own.
  const paintTheme = () => panel.setTheme(theme.resolved);
  const unsubscribeTheme = theme.subscribe(paintTheme);
  const showCount = (count: number) => {
    frame.detail.textContent = `${count} texture${count === 1 ? "" : "s"}`;
  };
  const onCount = (event: Event) => showCount((event as CustomEvent<number>).detail);

  paintTheme();
  panel.element.addEventListener("ttx-count", onCount);
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
      panel.element.removeEventListener("ttx-count", onCount);
      panel.dispose();
      frame.dispose();
      lab.dispose();
    },
  };
};
