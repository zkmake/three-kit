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
.tcm-badge { flex: none; color: var(--tcm-dim); }
.tcm-badge:empty { display: none; }
.tcm-badge.is-live, .tcm-badge.is-viewing { display: inline-flex; align-items: center; gap: 4px; }
.tcm-badge.is-live { color: var(--tcm-live); }
.tcm-badge.is-viewing { color: var(--tcm-accent); }
.tcm-badge.is-live::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: tcm-pulse 1.6s ease-in-out infinite;
}
@keyframes tcm-pulse { 50% { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) { .tcm-badge.is-live::before { animation: none; } }
.tcm-row.is-viewing .tcm-kind { color: var(--tcm-accent); border-color: color-mix(in srgb, var(--tcm-accent) 50%, transparent); }
.tcm-meta { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--tcm-dim); }
.tcm-actions { display: flex; gap: 2px; }
.tcm-chevron svg { transition: rotate 120ms; }
.tcm-row.is-open .tcm-chevron svg { rotate: 180deg; }

.tcm-details {
  display: none;
  gap: 8px;
  padding: 2px 8px 8px;
}
.tcm-row.is-open .tcm-details { display: grid; }
.tcm-group { display: grid; gap: 3px; }
.tcm-term { color: var(--tcm-dim); }
.tcm-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
.tcm-fields--lens { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.tcm-num {
  display: flex;
  align-items: center;
  min-width: 0;
  border: 1px solid var(--tcm-line);
  border-radius: 4px;
  background: var(--tcm-field);
}
.tcm-num:focus-within { border-color: var(--tcm-accent); }
.tcm-scrub {
  flex: none;
  padding: 0 5px;
  color: var(--tcm-dim);
  cursor: ew-resize;
  user-select: none;
  touch-action: none;
}
.tcm-scrub:hover { color: var(--tcm-fg); }
.tcm-num input {
  width: 100%;
  min-width: 0;
  padding: 3px 5px 3px 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: right;
  -moz-appearance: textfield;
  appearance: textfield;
}
.tcm-num input::-webkit-inner-spin-button, .tcm-num input::-webkit-outer-spin-button { appearance: none; margin: 0; }
.tcm-num input:focus { outline: none; }
.tcm-readout { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0; }
.tcm-readout dt { color: var(--tcm-dim); }
.tcm-readout dd { margin: 0; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.tcm-buttons { display: flex; gap: 6px; }
.tcm-text-button {
  border: 1px solid var(--tcm-line);
  border-radius: 4px;
  background: var(--tcm-field);
  padding: 3px 8px;
  cursor: pointer;
  white-space: nowrap;
}
.tcm-text-button:hover { border-color: var(--tcm-accent); }
.tcm-text-button:focus-visible { outline: 1px solid var(--tcm-accent); }
.tcm-views { display: flex; flex-wrap: wrap; gap: 4px; margin: 0; padding: 0; list-style: none; }
.tcm-views:empty { display: none; }
.tcm-view { display: flex; align-items: center; border: 1px solid var(--tcm-line); border-radius: 4px; }
.tcm-view .tcm-icon { width: 20px; height: 20px; }
.tcm-view .tcm-icon svg { width: 12px; height: 12px; }
.tcm-view-go {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 6px;
  border: 0;
  background: none;
  cursor: pointer;
}
.tcm-view-go svg { width: 12px; height: 12px; }
.tcm-view-go:hover { color: var(--tcm-accent); }
.tcm-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 4px 4px 8px;
  border-radius: 5px;
  background: var(--tcm-accent-soft);
  color: var(--tcm-accent);
}
.tcm-banner[hidden] { display: none; }
.tcm-status { color: var(--tcm-dim); padding: 0 4px; }
.tcm-status:empty { display: none; }
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
