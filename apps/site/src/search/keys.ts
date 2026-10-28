/**
 * The bits of ⌘K every page loads up front: which key opens it and what to call that key. The
 * palette itself (React, Base UI and the index) loads on first use.
 */

const isMac = () => /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

/** "⌘K" on a Mac, "Ctrl K" elsewhere. */
export const shortcutLabel = () => (isMac() ? "⌘K" : "Ctrl K");

/** ⌘K or Ctrl+K anywhere, and "/" outside a text field, as most docs sites' search. */
export function isOpenKey(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
    return true;
  }

  const field = (event.target as HTMLElement | null)?.closest?.(
    "input, textarea, select, [contenteditable]",
  );

  return event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !field;
}
