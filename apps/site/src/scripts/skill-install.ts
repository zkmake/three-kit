/**
 * The skills' install blocks (SkillInstall.astro): "any agent" or "Claude Code" tabs, remembered
 * across pages, and a copy button on each line.
 */
const STORAGE_KEY = "three-kit:skill-install";

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const startSkillInstall = () => {
  for (const block of document.querySelectorAll<HTMLElement>("[data-skill-install]")) {
    if (block.dataset.started) {
      continue;
    }

    block.dataset.started = "";

    const tabs = [...block.querySelectorAll<HTMLButtonElement>("[role=tab]")];
    const panels = [...block.querySelectorAll<HTMLElement>("[role=tabpanel]")];

    const show = (route: string) => {
      for (const tab of tabs) {
        tab.setAttribute("aria-selected", String(tab.dataset.route === route));
      }

      for (const panel of panels) {
        panel.hidden = panel.dataset.route !== route;
      }
    };

    const stored = readStored();

    if (stored && tabs.some((tab) => tab.dataset.route === stored)) {
      show(stored);
    }

    for (const tab of tabs) {
      tab.addEventListener("click", () => {
        const route = tab.dataset.route ?? "agents";

        show(route);

        try {
          localStorage.setItem(STORAGE_KEY, route);
        } catch {
          // The pick still applies to this page.
        }
      });
    }

    for (const copy of block.querySelectorAll<HTMLButtonElement>(".install__copy")) {
      const label = copy.getAttribute("aria-label") ?? "Copy";
      let timer = 0;

      copy.addEventListener("click", async () => {
        const text = copy.parentElement?.querySelector("code")?.textContent ?? "";

        try {
          await navigator.clipboard.writeText(text.trim());
          copy.classList.add("is-copied");
          copy.setAttribute("aria-label", "Copied");
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            copy.classList.remove("is-copied");
            copy.setAttribute("aria-label", label);
          }, 1200);
        } catch {
          // Clipboard blocked; the line is still selectable.
        }
      });
    }
  }
};

export { startSkillInstall };
