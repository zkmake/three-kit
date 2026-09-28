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

const startTheme = (onPick?: (mode: ThemeMode) => void) => {
  const pageTheme = new HudTheme(readStoredTheme());
  const buttons = [...document.querySelectorAll<HTMLButtonElement>("#theme [data-mode]")];

  const paint = () => {
    document.documentElement.dataset.theme = pageTheme.resolved;

    for (const button of buttons) {
      button.setAttribute("aria-checked", String(button.dataset.mode === pageTheme.mode));
    }
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode;

      if (isThemeMode(mode)) {
        pageTheme.setMode(mode);
        onPick?.(mode);
        writeStoredTheme(mode);
      }
    });
  }

  pageTheme.subscribe(paint);
  paint();

  return pageTheme;
};

export { BACKGROUNDS, startTheme };
