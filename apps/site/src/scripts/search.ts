/**
 * ⌘K on every page (Base.astro): ⌘K / Ctrl K, "/" outside a field, or a `data-cmdk-open` button
 * opens the palette (src/search/palette.tsx). Its React, Base UI and index load on that first use;
 * hovering or focusing an opener starts the download early. `data-cmdk-key` elements show ⌘K or
 * Ctrl K.
 */
import { isOpenKey, shortcutLabel } from "../search/keys.ts";

let loading: Promise<{ openPalette: () => void }> | undefined;

const load = () => (loading ??= import("../search/palette.tsx"));

const open = () => {
  void load().then(({ openPalette }) => openPalette());
};

const opener = (event: Event) =>
  (event.target as Element | null)?.closest?.("[data-cmdk-open]") ?? null;

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || !isOpenKey(event)) {
    return;
  }

  event.preventDefault();
  open();
});

document.addEventListener("click", (event) => {
  if (opener(event)) {
    open();
  }
});

const warm = (event: Event) => {
  if (opener(event)) {
    void load();
  }
};

document.addEventListener("pointerover", warm, { passive: true });
document.addEventListener("focusin", warm);

for (const element of document.querySelectorAll("[data-cmdk-key]")) {
  element.textContent = shortcutLabel();
}
