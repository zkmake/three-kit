/** The panel's stylesheet, injected once. Palettes by `data-theme` on `.tcm`. */
export const CAMERA_PANEL_STYLES = /* css */ `
/* Inside a dev-panel card the tokens come from three-meter's (\`--perf-*\`), so the panels match;
   on its own (in a host's tab) the same palette is the fallback. */
.tcm {
  --tcm-bg: var(--perf-bg, rgba(22, 24, 29, 0.92));
  --tcm-fg: var(--perf-fg, #e6e8eb);
  --tcm-dim: var(--perf-muted, #8b909a);
  --tcm-line: var(--perf-border, rgba(255, 255, 255, 0.12));
  --tcm-field: var(--perf-row, rgba(255, 255, 255, 0.04));
  --tcm-hover: var(--perf-row, rgba(255, 255, 255, 0.04));
  --tcm-accent: var(--perf-accent, #60a5fa);
  --tcm-accent-soft: rgba(96, 165, 250, 0.14);
  --tcm-live: #34d399;
  box-sizing: border-box;
  color: var(--tcm-fg);
  font: 11px/1.35 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
.tcm[data-theme="light"] {
  --tcm-bg: rgba(250, 250, 252, 0.94);
  --tcm-fg: #1a1c21;
  --tcm-dim: #6b7079;
  --tcm-line: rgba(0, 0, 0, 0.12);
  --tcm-field: rgba(0, 0, 0, 0.05);
  --tcm-hover: rgba(0, 0, 0, 0.05);
  --tcm-accent: #2563eb;
  --tcm-accent-soft: rgba(37, 99, 235, 0.1);
  --tcm-live: #047857;
}
.tcm *, .tcm *::before, .tcm *::after { box-sizing: inherit; }
.tcm button { font: inherit; color: inherit; }

.tcm-panel { display: flex; flex-direction: column; gap: 6px; min-height: 0; padding: 8px; }
/* In the dev-panel card: a fixed width (the frame's cap raised to fit), the list scrolling
   inside the card's height. */
.perf-hud.tcm-frame { max-width: min(23rem, calc(100vw - 48px)); }
.perf-hud__card > .tcm-panel { width: 22rem; max-width: 100%; flex: 1; }
/* Compact: the brand row alone, with the count. */
.perf-hud.tcm-compact .tcm-panel { display: none; }
.perf-hud.tcm-compact .perf-hud__brand { padding-bottom: 6px; }

.tcm-toolbar { display: flex; gap: 6px; }
.tcm-search {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--tcm-line);
  border-radius: 4px;
  background: var(--tcm-field);
  padding: 4px 6px;
  color: inherit;
  font: inherit;
}
.tcm-search::placeholder { color: var(--tcm-dim); }
.tcm-search:focus { outline: 1px solid var(--tcm-accent); outline-offset: 0; }

.tcm-icon {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: none;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--tcm-dim);
  cursor: pointer;
}
.tcm-icon:hover:not(:disabled) { background: var(--tcm-hover); color: var(--tcm-fg); }
.tcm-icon:focus-visible { outline: 1px solid var(--tcm-accent); }
.tcm-icon:disabled { visibility: hidden; }
.tcm-icon[aria-pressed="true"] { color: var(--tcm-accent); background: var(--tcm-accent-soft); }
.tcm svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tcm-list { margin: 0; padding: 0; list-style: none; overflow-y: auto; min-height: 0; }
.tcm-row { border-radius: 5px; border: 1px solid transparent; }
.tcm-row.is-hidden { display: none; }
.tcm-row.is-open { border-color: var(--tcm-line); background: var(--tcm-field); }
.tcm-head {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: 5px;
}
.tcm-row:not(.is-open) .tcm-head:hover { background: var(--tcm-hover); }
.tcm-kind {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--tcm-line);
  border-radius: 5px;
  color: var(--tcm-dim);
}
.tcm-row.is-live .tcm-kind { color: var(--tcm-live); border-color: color-mix(in srgb, var(--tcm-live) 45%, transparent); }
.tcm-text {
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
}
.tcm-name-line { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.tcm-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.tcm-live {
  display: none;
  flex: none;
  align-items: center;
  gap: 4px;
  color: var(--tcm-live);
}
.tcm-live::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: tcm-pulse 1.6s ease-in-out infinite;
}
.tcm-row.is-live .tcm-live { display: inline-flex; }
@keyframes tcm-pulse { 50% { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) { .tcm-live::before { animation: none; } }
.tcm-meta { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--tcm-dim); }
.tcm-actions { display: flex; gap: 2px; }
.tcm-chevron svg { transition: rotate 120ms; }
.tcm-row.is-open .tcm-chevron svg { rotate: 180deg; }

.tcm-details {
  display: none;
  grid-template-columns: auto 1fr;
  gap: 3px 10px;
  margin: 0;
  padding: 2px 8px 8px 44px;
}
.tcm-row.is-open .tcm-details { display: grid; }
.tcm-details dt { color: var(--tcm-dim); }
.tcm-details dd { margin: 0; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }

.tcm-empty { color: var(--tcm-dim); padding: 6px 4px; }
`;

const STYLE_ID = "zkmake-three-cameras-styles";

/** Add the stylesheet to `document.head` once. */
export const injectStyles = () => {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");

  style.id = STYLE_ID;
  style.textContent = CAMERA_PANEL_STYLES;
  document.head.append(style);
};
