/** The panel's stylesheet, injected once. Palettes by `data-theme` on `.ttx`. */
export const TEXTURE_PANEL_STYLES = /* css */ `
/* Inside a dev-panel card the tokens come from three-meter's (\`--perf-*\`), so the panels match;
   on its own (in a host's tab) the same palette is the fallback. */
.ttx {
  --ttx-bg: var(--perf-bg, rgba(22, 24, 29, 0.92));
  --ttx-fg: var(--perf-fg, #e6e8eb);
  --ttx-dim: var(--perf-muted, #8b909a);
  --ttx-line: var(--perf-border, rgba(255, 255, 255, 0.12));
  --ttx-field: var(--perf-row, rgba(255, 255, 255, 0.04));
  --ttx-hover: var(--perf-row, rgba(255, 255, 255, 0.04));
  --ttx-accent: var(--perf-accent, #60a5fa);
  --ttx-warn: var(--perf-warn, #f59e0b);
  --ttx-shadow: var(--perf-shadow, 0 8px 24px rgba(0, 0, 0, 0.32));
  --ttx-live: #34d399;
  --ttx-checker: rgba(255, 255, 255, 0.08);
  box-sizing: border-box;
  color: var(--ttx-fg);
  font: 11px/1.35 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
.ttx[data-theme="light"] {
  --ttx-bg: rgba(250, 250, 252, 0.94);
  --ttx-fg: #1a1c21;
  --ttx-dim: #6b7079;
  --ttx-line: rgba(0, 0, 0, 0.12);
  --ttx-field: rgba(0, 0, 0, 0.05);
  --ttx-hover: rgba(0, 0, 0, 0.05);
  --ttx-accent: #2563eb;
  --ttx-warn: #b45309;
  --ttx-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  --ttx-live: #047857;
  --ttx-checker: rgba(0, 0, 0, 0.07);
}
.ttx *, .ttx *::before, .ttx *::after { box-sizing: inherit; }
.ttx button { font: inherit; color: inherit; }

.ttx-panel { display: flex; flex-direction: column; gap: 6px; min-height: 0; padding: 8px; }
/* In the dev-panel card: a fixed width (the frame's cap raised to fit), the list scrolling
   inside the card's height. */
.perf-hud.ttx-frame { max-width: min(23rem, calc(100vw - 48px)); }
.perf-hud__card > .ttx-panel { width: 22rem; max-width: 100%; flex: 1; }
/* Compact: the brand row alone, with the count. */
.perf-hud.ttx-compact .ttx-panel { display: none; }
.perf-hud.ttx-compact .perf-hud__brand { padding-bottom: 6px; }
.ttx-toolbar { display: flex; gap: 6px; }
.ttx-search {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--ttx-line);
  border-radius: 4px;
  background: var(--ttx-field);
  padding: 4px 6px;
  color: inherit;
  font: inherit;
}
.ttx-search::placeholder { color: var(--ttx-dim); }
.ttx-search:focus { outline: 1px solid var(--ttx-accent); outline-offset: 0; }

.ttx-icon {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: none;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--ttx-dim);
  cursor: pointer;
}
.ttx-icon:hover:not(:disabled) { background: var(--ttx-hover); color: var(--ttx-fg); }
.ttx-icon:focus-visible { outline: 1px solid var(--ttx-accent); }
.ttx-icon:disabled { opacity: 0.3; cursor: default; }
.ttx-icon svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
/* A/B and undo show once the row has something to compare or undo. */
.ttx-actions [data-action="compare"]:disabled,
.ttx-actions [data-action="revert"]:disabled { visibility: hidden; }
.ttx-icon.is-on { color: var(--ttx-accent); background: var(--ttx-accent-soft); }
.ttx-icon.is-live { color: var(--ttx-live); }
.ttx-icon.is-paused { color: var(--ttx-warn); }
.ttx-icon.is-live::after,
.ttx-icon.is-paused::after {
  content: "";
  position: absolute;
  top: 3px;
  right: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.ttx-icon.is-live::after { animation: ttx-pulse 1.6s ease-in-out infinite; }
@keyframes ttx-pulse { 50% { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) { .ttx-icon.is-live::after { animation: none; } }
.ttx-text-button {
  border: 1px solid var(--ttx-line);
  border-radius: 4px;
  background: var(--ttx-field);
  padding: 3px 8px;
  cursor: pointer;
  white-space: nowrap;
}
.ttx-text-button:hover:not(:disabled) { border-color: var(--ttx-accent); }
.ttx-text-button:disabled { opacity: 0.4; cursor: default; }

.ttx-list { margin: 0; padding: 0; list-style: none; overflow-y: auto; min-height: 0; }
.ttx-row {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: 5px;
  border: 1px solid transparent;
}
.ttx-row:hover { background: var(--ttx-hover); }
.ttx-row.is-drop { border-color: var(--ttx-accent); background: var(--ttx-accent-soft); }
.ttx-row.is-hidden { display: none; }
.ttx-row.is-unsupported { opacity: 0.5; }
.ttx-thumb {
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--ttx-line);
  border-radius: 4px;
  background: repeating-conic-gradient(var(--ttx-checker) 0 25%, transparent 0 50%) 0 0 / 8px 8px;
  cursor: zoom-in;
  overflow: hidden;
}
.ttx-thumb img { display: block; width: 100%; height: 100%; object-fit: contain; }
.ttx-row.is-swapped .ttx-thumb { border-color: var(--ttx-accent); }
.ttx-row.is-showing-original .ttx-thumb { border-color: var(--ttx-warn); }
.ttx-text { min-width: 0; }
.ttx-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.ttx-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ttx-dim); }
.ttx-swap-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ttx-accent); }
.ttx-row.is-showing-original .ttx-swap-name { color: var(--ttx-warn); }
.ttx-swap-name[hidden] { display: none; }
.ttx-actions { display: flex; gap: 2px; }
.ttx-empty, .ttx-status { color: var(--ttx-dim); padding: 6px 4px; }
.ttx-status.is-error { color: var(--ttx-warn); }
.ttx-status:empty { display: none; }

.ttx-preview {
  position: fixed;
  z-index: 2147483001;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--ttx-line);
  border-radius: 8px;
  background: var(--ttx-bg);
  box-shadow: var(--ttx-shadow);
}
.ttx-preview[hidden] { display: none; }
.ttx-preview img {
  display: block;
  max-width: 100%;
  image-rendering: pixelated;
  background: repeating-conic-gradient(var(--ttx-checker) 0 25%, transparent 0 50%) 0 0 / 16px 16px;
}
.ttx-preview-label { color: var(--ttx-dim); }
`;

const STYLE_ID = "zkmake-three-textures-styles";

/** Add the stylesheet to `document.head` once. */
export const injectStyles = () => {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");

  style.id = STYLE_ID;
  style.textContent = TEXTURE_PANEL_STYLES;
  document.head.append(style);
};
