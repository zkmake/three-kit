/**
 * Install commands (InstallCommand.astro): package-manager tabs and a copy button on each. A tab
 * picked on one applies to every one on the page and is remembered. Commands come from
 * `data-commands`.
 */
import { PM_STORAGE_KEY } from "./keys.ts";

const readStored = () => {
  try {
    return localStorage.getItem(PM_STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeStored = (pm: string) => {
  try {
    localStorage.setItem(PM_STORAGE_KEY, pm);
  } catch {
    // The pick still applies to this page.
  }
};

const startInstall = () => {
  const blocks = [...document.querySelectorAll<HTMLElement>("[data-install]")].map((element) => ({
    element,
    commands: JSON.parse(element.dataset.commands ?? "{}") as Record<string, string>,
    command: element.querySelector(".install__command")!,
    tabs: [...element.querySelectorAll<HTMLButtonElement>("[data-pm]")],
    copy: element.querySelector<HTMLButtonElement>(".install__copy")!,
  }));
  let packageManager = readStored() ?? "bun";

  const paint = () => {
    for (const block of blocks) {
      const pm = packageManager in block.commands ? packageManager : "bun";

      block.command.textContent = block.commands[pm] ?? "";

      for (const tab of block.tabs) {
        tab.setAttribute("aria-selected", String(tab.dataset.pm === pm));
      }
    }
  };

  for (const block of blocks) {
    for (const tab of block.tabs) {
      tab.addEventListener("click", () => {
        const pm = tab.dataset.pm;

        if (pm && pm in block.commands) {
          packageManager = pm;
          writeStored(pm);
          paint();
        }
      });
    }

    let copiedTimer = 0;
    const label = block.copy.getAttribute("aria-label") ?? "Copy install command";

    block.copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(block.command.textContent ?? "");
        block.copy.classList.add("is-copied");
        block.copy.setAttribute("aria-label", "Copied");
        window.clearTimeout(copiedTimer);
        copiedTimer = window.setTimeout(() => {
          block.copy.classList.remove("is-copied");
          block.copy.setAttribute("aria-label", label);
        }, 1200);
      } catch {
        // Clipboard blocked; the command is still selectable.
      }
    });
  }

  paint();
};

export { startInstall };
