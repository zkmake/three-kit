/**
 * The example site. One page, two integrations of the same scene: plain three
 * (`demos/vanilla.ts`) and React Three Fiber (`demos/r3f.tsx`), swapped in place from the header.
 * Both mount into `#stage` and share storage keys, so the panels' docks and the swaps carry
 * across the switch. `?r3f` opens on Fiber. The header's theme toggle sets the page and both
 * panels together.
 */
import { HudTheme, isThemeMode, type ThemeMode } from "@zkmake/three-meter/ui";

import { type Demo, type DemoKind, isDemoKind } from "./demo.ts";

import "./style.css";

const THEME_STORAGE_KEY = "three-textures-example:theme";
const PANEL_STORAGE_KEY = "three-textures-example";
const BACKGROUNDS = { dark: "#0f1115", light: "#f3f4f6" } as const;
const INSTALL_COMMANDS = {
  bun: "bun add -d @zkmake/three-textures",
  npm: "npm i -D @zkmake/three-textures",
  pnpm: "pnpm add -D @zkmake/three-textures",
} as const;
const USAGE: Record<DemoKind, string> = {
  r3f: "<TexturePanel />",
  vanilla: "mountTexturePanel({ scene, renderer })",
};

type PackageManager = keyof typeof INSTALL_COMMANDS;

const params = new URLSearchParams(location.search);
let demoKind: DemoKind = params.has("r3f") ? "r3f" : "vanilla";

const stage = document.querySelector<HTMLElement>("#stage")!;
const note = document.querySelector("#note")!;
const usageEl = document.querySelector("#install-usage")!;
const demoButtons = [...document.querySelectorAll<HTMLButtonElement>("#demo [data-demo]")];
const themeButtons = [...document.querySelectorAll<HTMLButtonElement>("#theme [data-mode]")];

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

const pageTheme = new HudTheme(readStoredTheme());

// Demo lifecycle. `token` guards against a slow load landing after a switch.
let demo: Demo | null = null;
let token = 0;

const loadDemo = async (kind: DemoKind) => {
  const mine = ++token;

  demo?.dispose();
  demo = null;
  stage.replaceChildren();

  const factory =
    kind === "r3f"
      ? (await import("./demos/r3f.tsx")).createR3fDemo
      : (await import("./demos/vanilla.ts")).createVanillaDemo;

  if (mine !== token) {
    return;
  }

  const next = await factory(stage, {
    background: BACKGROUNDS[pageTheme.resolved],
    storageKey: PANEL_STORAGE_KEY,
    theme: pageTheme.mode,
  });

  if (mine !== token) {
    next.dispose();

    return;
  }

  demo = next;
};

const paintDemo = () => {
  usageEl.textContent = USAGE[demoKind];
  note.textContent = "live link needs Chrome or Edge";

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
    history.replaceState(null, "", kind === "r3f" ? "?r3f" : location.pathname);
    paintDemo();
    void loadDemo(kind);
  });
}

const paintTheme = () => {
  const resolved = pageTheme.resolved;

  document.documentElement.dataset.theme = resolved;
  demo?.setBackground(BACKGROUNDS[resolved]);

  for (const button of themeButtons) {
    button.setAttribute("aria-checked", String(button.dataset.mode === pageTheme.mode));
  }
};

for (const button of themeButtons) {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;

    if (isThemeMode(mode)) {
      pageTheme.setMode(mode);
      demo?.setTheme(mode);
      writeStoredTheme(mode);
    }
  });
}

pageTheme.subscribe(paintTheme);
paintTheme();

// Install card: package-manager tabs and a copy button.
const commandEl = document.querySelector("#install-command")!;
const copyButton = document.querySelector<HTMLButtonElement>("#copy")!;
const pmButtons = [...document.querySelectorAll<HTMLButtonElement>("#pm [data-pm]")];
let packageManager: PackageManager = "bun";

const paintInstall = () => {
  commandEl.textContent = INSTALL_COMMANDS[packageManager];

  for (const button of pmButtons) {
    button.setAttribute("aria-selected", String(button.dataset.pm === packageManager));
  }
};

for (const button of pmButtons) {
  button.addEventListener("click", () => {
    const pm = button.dataset.pm;

    if (pm && pm in INSTALL_COMMANDS) {
      packageManager = pm as PackageManager;
      paintInstall();
    }
  });
}

let copiedTimer = 0;

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(INSTALL_COMMANDS[packageManager]);
    copyButton.classList.add("is-copied");
    copyButton.setAttribute("aria-label", "Copied");
    window.clearTimeout(copiedTimer);
    copiedTimer = window.setTimeout(() => {
      copyButton.classList.remove("is-copied");
      copyButton.setAttribute("aria-label", "Copy install command");
    }, 1200);
  } catch {
    // Clipboard blocked; the command is still selectable.
  }
});

paintInstall();
paintDemo();
void loadDemo(demoKind);
