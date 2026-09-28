/** The install card: package-manager tabs and a copy button. Commands come from `data-commands`. */
const startInstall = () => {
  const card = document.querySelector<HTMLElement>(".install");

  if (!card) {
    return;
  }

  const commands = JSON.parse(card.dataset.commands ?? "{}") as Record<string, string>;
  const commandEl = card.querySelector(".install__command")!;
  const copyButton = card.querySelector<HTMLButtonElement>(".install__copy")!;
  const pmButtons = [...card.querySelectorAll<HTMLButtonElement>("[data-pm]")];
  let packageManager = "bun";

  const paint = () => {
    commandEl.textContent = commands[packageManager] ?? "";

    for (const button of pmButtons) {
      button.setAttribute("aria-selected", String(button.dataset.pm === packageManager));
    }
  };

  for (const button of pmButtons) {
    button.addEventListener("click", () => {
      const pm = button.dataset.pm;

      if (pm && pm in commands) {
        packageManager = pm;
        paint();
      }
    });
  }

  let copiedTimer = 0;

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(commands[packageManager] ?? "");
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

  paint();
};

export { startInstall };
