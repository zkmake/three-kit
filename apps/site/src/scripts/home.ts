/**
 * The landing page: theme, install commands, the code card and card clips straight away; the
 * scene (three and the HUD, scripts/hero.ts) after first paint, so the page reads before it draws.
 */
import type { ThemeMode } from "@zkmake/three-meter/ui";

import { startCardMedia } from "./card-media.ts";
import { startHeroCode } from "./hero-code.ts";
import { startInstall } from "./install.ts";
import { startTheme } from "./theme.ts";

const startHome = () => {
  let hero: { setTheme: (mode: ThemeMode) => void } | null = null;
  const pageTheme = startTheme((mode) => hero?.setTheme(mode));
  const host = document.querySelector<HTMLElement>("[data-hero-scene]");

  startInstall();
  startHeroCode();
  startCardMedia();

  let started = false;

  const loadHero = async () => {
    if (!host || started) {
      return;
    }

    started = true;

    try {
      const { startHero } = await import("./hero.ts");

      hero = startHero(host, pageTheme.mode);
    } catch {
      // No WebGL: the hero keeps its backdrop.
    }
  };

  // On idle; the timer covers a tab opened in the background, where idle callbacks can wait.
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => void loadHero(), { timeout: 1200 });
  }

  setTimeout(() => void loadHero(), 1500);
};

export { startHome };
