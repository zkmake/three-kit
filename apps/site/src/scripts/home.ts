/**
 * The landing page: theme, install commands, the code card and card clips straight away; the
 * scene (three and the HUD, scripts/hero.ts) after first paint, so the page reads before it draws,
 * and only on a GPU: without one the poster stays.
 */
import type { ThemeMode } from "@zkmake/three-meter/ui";

import { startCardGlow, startCardMedia } from "./card-media.ts";
import { startHeroCode } from "./hero-code.ts";
import { startInstall } from "./install.ts";
import { startTheme } from "./theme.ts";

/**
 * A GPU-backed WebGL2 context. Software rendering (SwiftShader, llvmpipe: machines without a GPU,
 * headless browsers) compiles the scene's shaders for seconds on the main thread, so there the
 * hero keeps its poster and never loads three.
 */
const hasHardwareWebGL = () => {
  try {
    const gl = document
      .createElement("canvas")
      .getContext("webgl2", { failIfMajorPerformanceCaveat: true });

    if (!gl) {
      return false;
    }

    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";

    gl.getExtension("WEBGL_lose_context")?.loseContext();

    return !/swiftshader|llvmpipe|softpipe|software/i.test(name);
  } catch {
    return false;
  }
};

const startHome = () => {
  let hero: { setTheme: (mode: ThemeMode) => void } | null = null;
  const pageTheme = startTheme((mode) => hero?.setTheme(mode));
  const host = document.querySelector<HTMLElement>("[data-hero-scene]");

  startInstall();
  startHeroCode();
  startCardMedia();
  startCardGlow();

  let started = false;

  const loadHero = async () => {
    if (!host || started) {
      return;
    }

    started = true;

    // `?live-hero` forces the scene anyway: scripts/make-og.ts draws its poster in headless Chrome.
    if (!hasHardwareWebGL() && !new URLSearchParams(location.search).has("live-hero")) {
      return;
    }

    try {
      const { startHero } = await import("./hero.ts");

      hero = await startHero(host, pageTheme.mode);
    } catch {
      // WebGL failed after all: the hero keeps its poster.
    }
  };

  // On idle; the timer covers a tab opened in the background, where idle callbacks can wait.
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => void loadHero(), { timeout: 1200 });
  }

  setTimeout(() => void loadHero(), 1500);
};

export { startHome };
