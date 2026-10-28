import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { url } from "../paths.ts";
import { PM_STORAGE_KEY } from "../scripts/keys.ts";
import { action, CommandMenu, type SearchAction } from "./command-menu.tsx";
import type { SearchEntry } from "./rank.ts";

/**
 * ⌘K's React root, loaded by scripts/search.ts on the first ⌘K, "/" or opener click: it opens at
 * once, fetches `search.json`, and from then on `openPalette()` reopens it. The site has no
 * client router, so a pick is a plain page load.
 */

const theme = (mode: "light" | "dark" | "system") => () =>
  document.querySelector<HTMLButtonElement>(`#theme [data-mode="${mode}"]`)?.click();

const go = (href: string) => {
  if (/^https?:/.test(href)) {
    window.open(href, "_blank", "noopener,noreferrer");

    return;
  }

  window.location.assign(href);
};

const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => {});

/** The install command in the package manager picked on the site, bun until one is. */
const installCommand = (commands: Record<string, string>) => {
  let pm = "bun";

  try {
    pm = localStorage.getItem(PM_STORAGE_KEY) ?? pm;
  } catch {
    // bun, then.
  }

  return commands[pm] ?? commands.bun ?? "";
};

function commands(entries: readonly SearchEntry[] | undefined): SearchAction[] {
  const dark = document.documentElement.dataset.theme === "dark";
  const installs = (entries ?? []).flatMap((entry) =>
    entry.kind === "package" && entry.install
      ? [
          action(
            "install",
            `Copy install command: ${entry.label}`,
            () => copy(installCommand(entry.install!)),
            `install add npm bun pnpm yarn ${entry.label}`,
            installCommand(entry.install),
          ),
        ]
      : [],
  );

  return [
    dark
      ? action("light", "Switch to light theme", theme("light"), "theme day mode", "theme --light")
      : action("dark", "Switch to dark theme", theme("dark"), "theme night mode", "theme --dark"),
    action(
      "link",
      "Copy link to this page",
      () => copy(window.location.href.replace(/#.*$/, "")),
      "share url clipboard",
      "pbcopy < $URL",
    ),
    action(
      "top",
      "Scroll to top",
      () => window.scrollTo({ top: 0, behavior: "smooth" }),
      "up start",
      "gg",
    ),
    action(
      "system",
      "Match system theme",
      theme("system"),
      "theme auto os device",
      "theme --system",
    ),
    ...installs,
  ];
}

let reopen: (() => void) | undefined;

function Palette() {
  // mounted by someone reaching for search, so it opens straight away
  const [open, setOpen] = useState(true);
  const [entries, setEntries] = useState<SearchEntry[]>();
  // rebuilt on each opening, so the theme command offers the other theme
  const [actions, setActions] = useState<SearchAction[]>(() => commands(undefined));

  useEffect(() => {
    let live = true;

    fetch(url("search.json"))
      .then((response) => response.json() as Promise<SearchEntry[]>)
      .then((list) => {
        if (live) {
          setEntries(list);
          setActions(commands(list));
        }
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    reopen = () => {
      setActions(commands(entries));
      setOpen(true);
    };

    return () => {
      reopen = undefined;
    };
  }, [entries]);

  return (
    <CommandMenu open={open} onOpenChange={setOpen} entries={entries} actions={actions} go={go} />
  );
}

/** Opens the palette, mounting it the first time. */
export function openPalette() {
  if (reopen) {
    reopen();

    return;
  }

  const host = document.createElement("div");

  host.id = "cmdk";
  document.body.append(host);
  createRoot(host).render(<Palette />);
}
