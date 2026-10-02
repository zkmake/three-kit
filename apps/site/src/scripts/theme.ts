/**
 * The header's theme toggle. The page keeps its own `HudTheme`, so a pick in a panel's own theme
 * row restyles that panel only; a pick here goes to `onPick` too, for the demo to pass on.
 */
import { HudTheme, isThemeMode, type ThemeMode } from "@zkmake/three-meter/ui";

import { THEME_STORAGE_KEY } from "./keys.ts";

/** The scene backgrounds, matching `--site-bg`. */
const BACKGROUNDS = { dark: "#0f1115", light: "#f3f4f6" } as const;

const readStoredTheme = (): ThemeMode => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);

    return isThemeMode(stored) ? stored : "system";
  } catch {
    return "system";
  }
};

const writeStoredTheme = (mode: ThemeMode) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // The live toggle still applies.
  }
};

/** The phones' theme button steps through these, in the toggle's order. */
const CYCLE: ThemeMode[] = ["light", "system", "dark"];
const MODE_NAMES: Record<ThemeMode, string> = {
  light: "light",
  system: "follow the system",
  dark: "dark",
};

const startTheme = (onPick?: (mode: ThemeMode) => void) => {
  const pageTheme = new HudTheme(readStoredTheme());
  const buttons = [...document.querySelectorAll<HTMLButtonElement>("#theme [data-mode]")];
  // The phones' single button: each press moves to the next mode.
  const cycle = document.querySelector<HTMLButtonElement>("#theme-cycle");

  const pick = (mode: ThemeMode) => {
    pageTheme.setMode(mode);
    onPick?.(mode);
    writeStoredTheme(mode);
  };

  const paint = () => {
    document.documentElement.dataset.theme = pageTheme.resolved;

    for (const button of buttons) {
      button.setAttribute("aria-checked", String(button.dataset.mode === pageTheme.mode));
    }

    if (cycle) {
      cycle.dataset.mode = pageTheme.mode;
      cycle.setAttribute("aria-label", `Theme: ${MODE_NAMES[pageTheme.mode]}. Change theme`);
    }
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode;

      if (isThemeMode(mode)) {
        pick(mode);
      }
    });
  }

  cycle?.addEventListener("click", () => {
    pick(CYCLE[(CYCLE.indexOf(pageTheme.mode) + 1) % CYCLE.length]!);
  });

  pageTheme.subscribe(paint);
  paint();

  return pageTheme;
};

export { BACKGROUNDS, startTheme };
