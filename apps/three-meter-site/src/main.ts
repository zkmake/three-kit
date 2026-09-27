/**
 * The demo site. One page, two integrations of the same scene: plain three
 * (`demos/vanilla.ts`) and React Three Fiber (`demos/r3f.tsx`), swapped in
 * place from the header. Both mount into `#stage` and share one HUD storage
 * key, so the dock and the metric selection carry across the switch.
 *
 * URL: `?r3f` picks Fiber, `?webgpu` swaps in `WebGPURenderer`, `?count=5000`
 * scales the scene. The header's theme toggle sets the page's own `HudTheme`
 * and the HUD's consumer layer together; a pick in the panel's own theme row
 * overrides the HUD alone.
 */
import { HudTheme, isThemeMode, type ThemeMode } from "@zkmake/three-meter/ui";

import { type Demo, type DemoKind, isDemoKind } from "./demo.ts";

import "./style.css";

const THEME_STORAGE_KEY = "three-meter-example:theme";
const HUD_STORAGE_KEY = "three-meter-example:hud";
const BACKGROUNDS = { dark: "#0f1115", light: "#f3f4f6" } as const;
const INSTALL_COMMANDS = {
  bun: "bun add -d @zkmake/three-meter",
  npm: "npm i -D @zkmake/three-meter",
  pnpm: "pnpm add -D @zkmake/three-meter",
} as const;
const USAGE: Record<DemoKind, string> = {
  r3f: "<PerfSampler /> + <PerfHud />",
  vanilla: "mountPerfHud(monitor)",
};

type PackageManager = keyof typeof INSTALL_COMMANDS;

const params = new URLSearchParams(location.search);
const useWebgpu = params.has("webgpu");
const count = Math.max(1, Number(params.get("count") ?? 2000));
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

const pageTheme = new HudTheme(readStoredTheme());

// Demo lifecycle. `token` guards against a slow WebGPU init landing after a switch.
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
    count,
    storageKey: HUD_STORAGE_KEY,
    theme: pageTheme.mode,
    webgpu: useWebgpu,
  });

  if (mine !== token) {
    next.dispose();

    return;
  }

  demo = next;
};

const paintDemo = () => {
  usageEl.textContent = USAGE[demoKind];

  const backend = useWebgpu
    ? `WebGPU · <a href="${hrefWith((q) => q.delete("webgpu"))}">switch to WebGL</a>`
    : `WebGL · <a href="${hrefWith((q) => q.set("webgpu", ""))}">switch to WebGPU</a>`;
  note.innerHTML = demoKind === "r3f" ? `${backend} · <b>p</b> toggles the sampler` : backend;

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
    paintDemo();
    void loadDemo(kind);
  });
}

// Site theme: the page has its own controller so a pick inside the panel
// restyles the HUD only. The header toggle sets both.
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

// Install panel: package-manager tabs and a copy button.
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
