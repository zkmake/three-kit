/** The header's library menu closes on a pick elsewhere or Escape, like a native one. */
for (const menu of document.querySelectorAll<HTMLDetailsElement>(".menu")) {
  document.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Node && !menu.contains(event.target)) {
      menu.open = false;
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      menu.querySelector("summary")?.focus();
    }
  });
}
