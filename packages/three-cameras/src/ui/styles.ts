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
/* With the timeline: one panel across the bottom of the screen, anchored (no drag grip), the
   camera list as the timeline's sidebar. Compact, the list alone. */
.perf-hud.tcm-combined-frame .perf-hud__drag { display: none; }
/* Full width: the control discs go in a row on the open side, above the panel on the bottom
   edge and below it on the top, so the panel can reach both sides of the screen. */
.perf-hud.tcm-combined-frame:not(.tcm-compact) { width: calc(100vw - 20px); max-width: none; }
.perf-hud.tcm-combined-frame:not(.tcm-compact) .perf-hud__tools { left: auto; right: 4px; flex-direction: row; }
.perf-hud.tcm-combined-frame:not(.tcm-compact)[data-edge="bottom"] .perf-hud__tools { top: auto; bottom: calc(100% + 6px); }
.perf-hud.tcm-combined-frame:not(.tcm-compact)[data-edge="top"] .perf-hud__tools { top: calc(100% + 6px); }
.perf-hud.tcm-combined-frame:not(.tcm-compact) .perf-hud__hotspot { right: -10px; left: -10px; }
.perf-hud.tcm-combined-frame:not(.tcm-compact)[data-edge="bottom"] .perf-hud__hotspot { top: -40px; bottom: -10px; }
.perf-hud.tcm-combined-frame:not(.tcm-compact)[data-edge="top"] .perf-hud__hotspot { top: -10px; bottom: -40px; }
.tcm-shell { display: flex; flex-direction: column; min-height: 0; }
.tcm-shell > .tcm-timeline.is-combined { width: 100%; max-height: min(28rem, 40vh); }
.tcm-shell > .tcm-panel { width: 22rem; max-width: 100%; }
.tcm-timeline.is-combined { min-height: 0; padding-bottom: 6px; }
/* Names take 21rem, or 64% on a narrow panel, so the keys lane keeps room for 24px keys. */
.tcm-timeline.is-combined .tcm-tl { flex: 1; min-height: 0; grid-template-columns: min(21rem, 64%) minmax(0, 1fr); overflow-y: auto; }
.tcm-timeline.is-combined .tcm-tl-names { display: block; border-right: 1px solid var(--tcm-line); }
.tcm-timeline.is-combined .tcm-tl-names > .tcm-panel { padding: 0 6px 0 0; }
.tcm-timeline.is-combined .tcm-panel .tcm-list { overflow: visible; }
.tcm-timeline.is-combined .tcm-panel .tcm-toolbar,
.tcm-timeline.is-combined .tcm-ruler { position: sticky; top: 0; z-index: 2; height: 30px; background: var(--tcm-bg); }
.tcm-timeline.is-combined .tcm-panel .tcm-toolbar { align-items: center; }
.tcm-timeline.is-combined .tcm-tl-area { margin-left: 0; }
.tcm-timeline.is-combined .tcm-lanes { position: relative; display: block; }
.tcm-timeline.is-combined .tcm-lane { position: absolute; left: 0; right: 0; border-bottom: 0; border-top: 1px solid var(--tcm-line); }
.tcm-timeline.is-combined .tcm-lane[hidden] { display: none; }
.tcm-timeline.is-combined .tcm-lane.is-inert { cursor: default; background: repeating-linear-gradient(135deg, transparent 0 6px, var(--tcm-field) 6px 7px); }
.tcm-timeline.is-combined .tcm-key { top: calc(var(--tcm-head, 24px) / 2); }
.tcm-timeline.is-combined .tcm-graph-side { padding: 6px 0 4px; }

/* Compact, the list alone: the brand row, with the count. */
/* Collapsed: a small widget with the picked camera, and nothing else. */
.perf-hud.tcm-compact .tcm-shell > :not(.tcm-mini) { display: none; }
.perf-hud.tcm-frame.tcm-compact .perf-hud__brand-detail { display: none; }
.tcm-mini { display: none; }
.perf-hud.tcm-compact .tcm-mini {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 10rem;
  max-width: 18rem;
  margin: 0 6px 6px;
  padding: 3px 8px 3px 4px;
  border: 1px solid var(--tcm-line);
  border-radius: 5px;
  background: var(--tcm-field);
  text-align: left;
  cursor: pointer;
}
.tcm-mini:hover { border-color: var(--tcm-accent); }
.tcm-mini:focus-visible { outline: 1px solid var(--tcm-accent); }
.tcm-mini-kind { display: grid; place-items: center; color: var(--tcm-dim); }
.tcm-mini.is-live .tcm-mini-kind { color: var(--tcm-live); }
.tcm-mini.is-viewing .tcm-mini-kind { color: var(--tcm-accent); }
.tcm-mini-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.tcm-mini-clock { margin-left: auto; color: var(--tcm-dim); font-variant-numeric: tabular-nums; }
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
/* Line icons; the graph and the ease editor draw their own. */
.tcm svg:not(.tcm-graph-svg, .tcm-ease svg) {
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
/* Short of room, the badge gives way before the name does. */
.tcm-name { flex: 0 1 auto; min-width: min(100%, 6ch); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.tcm-badge { flex: 0 100 auto; min-width: 0; overflow: hidden; white-space: nowrap; color: var(--tcm-dim); }
.tcm-badge:empty { display: none; }
.tcm-badge.is-live, .tcm-badge.is-viewing { display: inline-flex; align-items: center; gap: 4px; }
.tcm-badge.is-live { color: var(--tcm-live); }
.tcm-badge.is-viewing { color: var(--tcm-accent); }
.tcm-badge.is-live::before {
  content: "";
  flex: none;
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
.tcm-row.is-selected:not(.is-open) .tcm-head { background: var(--tcm-hover); }
.tcm-keys { color: var(--tcm-accent); }

/* Timeline */
.tcm-timeline { display: flex; flex-direction: column; gap: 6px; padding: 8px; outline: none; }
.tcm-transport, .tcm-inspector { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.tcm-spacer { flex: 1; }
.tcm-clock { min-width: 9.5em; padding: 0 6px; font-variant-numeric: tabular-nums; }
.tcm-timeline.is-engaged .tcm-clock { color: var(--tcm-accent); }
.tcm-length { display: inline-flex; align-items: center; gap: 4px; color: var(--tcm-dim); }
.tcm-length input, .tcm-inspector select {
  width: 4.5em;
  padding: 2px 4px;
  border: 1px solid var(--tcm-line);
  border-radius: 4px;
  background: var(--tcm-field);
  color: var(--tcm-fg);
  font: inherit;
  font-variant-numeric: tabular-nums;
}
.tcm-inspector select { width: auto; }
.tcm-length input:focus, .tcm-inspector select:focus { outline: 1px solid var(--tcm-accent); }
.tcm-add-key { display: inline-flex; align-items: center; gap: 5px; max-width: 14em; }
.tcm-add-key span { overflow: hidden; text-overflow: ellipsis; }
.tcm-add-key svg { width: 12px; height: 12px; color: var(--tcm-accent); }
.tcm-add-key:disabled { opacity: 0.4; cursor: default; }
.tcm-inspector { padding: 4px 6px; border-radius: 5px; background: var(--tcm-field); }
.tcm-inspector[hidden] { display: none; }
.tcm-inspector-title { font-weight: 600; margin-right: 4px; }

.tcm-tl { display: grid; grid-template-columns: 7.5rem minmax(0, 1fr); }
.tcm-tl-names { display: grid; grid-auto-rows: 24px; grid-template-rows: 20px; }
.tcm-tl-corner { border-bottom: 1px solid var(--tcm-line); }
.tcm-tl-name {
  overflow: hidden;
  padding: 0 8px 0 2px;
  border: 0;
  border-bottom: 1px solid var(--tcm-line);
  background: none;
  color: var(--tcm-dim);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.tcm-tl-name:hover, .tcm-tl-name.is-selected { color: var(--tcm-fg); }
.tcm-tl-name.is-selected { font-weight: 600; }
.tcm-tl-area { position: relative; min-width: 0; margin-right: 8px; }
.tcm-ruler {
  position: relative;
  height: 20px;
  border-bottom: 1px solid var(--tcm-line);
  cursor: ew-resize;
  touch-action: none;
}
.tcm-tick { position: absolute; bottom: 0; width: 1px; height: 4px; background: var(--tcm-line); }
.tcm-tick.is-major { height: 8px; background: var(--tcm-dim); }
.tcm-tick b {
  position: absolute;
  bottom: 9px;
  left: 0;
  transform: translateX(-50%);
  color: var(--tcm-dim);
  font-weight: 400;
  font-size: 10px;
}
.tcm-lanes { display: grid; grid-auto-rows: 24px; }
.tcm-lane { position: relative; border-bottom: 1px solid var(--tcm-line); cursor: crosshair; touch-action: none; }
.tcm-lane.is-selected { background: var(--tcm-hover); }
/* The button is a 24px hit area (the lane's height); ::before draws the 11px diamond. */
.tcm-key {
  position: absolute;
  top: 50%;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: none;
  transform: translate(-50%, -50%);
  cursor: grab;
  touch-action: none;
}
.tcm-key::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  box-sizing: border-box;
  width: 11px;
  height: 11px;
  border: 1px solid var(--tcm-bg);
  border-radius: 2px;
  background: var(--tcm-accent);
  transform: translate(-50%, -50%) rotate(45deg);
}
.tcm-key.is-hold::before { border-radius: 0; background: var(--tcm-dim); }
.tcm-key.is-picked::before { outline: 2px solid var(--tcm-fg); outline-offset: 1px; }
.tcm-key:active { cursor: grabbing; }
.tcm-key:focus-visible { outline: none; }
.tcm-key:focus-visible::before { outline: 2px solid var(--tcm-accent); outline-offset: 2px; }
.tcm-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  margin-left: -0.5px;
  background: #f87171;
  pointer-events: none;
}
.tcm-playhead::before {
  content: "";
  position: absolute;
  top: 0;
  left: -4px;
  border: 4.5px solid transparent;
  border-top-color: #f87171;
}
.tcm-tl-empty { padding: 2px 4px; }

/* Keys | Graph */
.tcm-modes { display: inline-flex; margin-left: 4px; border: 1px solid var(--tcm-line); border-radius: 5px; overflow: hidden; }
.tcm-modes button { padding: 2px 8px; border: 0; background: none; color: var(--tcm-dim); cursor: pointer; }
.tcm-modes button[aria-checked="true"] { background: var(--tcm-accent-soft); color: var(--tcm-accent); }
.tcm-modes button:focus-visible { outline: 1px solid var(--tcm-accent); outline-offset: -2px; }

/* Lane names with the motion-path toggle */
.tcm-tl-row { display: flex; align-items: center; min-width: 0; border-bottom: 1px solid var(--tcm-line); }
.tcm-tl-row .tcm-tl-name { flex: 1; min-width: 0; height: 100%; border-bottom: 0; }
.tcm-trail { width: 20px; height: 20px; margin-right: 4px; }
.tcm-trail svg { width: 13px; height: 13px; }
.tcm-trail:disabled { visibility: hidden; }

/* Graph view: the channel list in the names column, the plot under the ruler. */
.tcm-graph, .tcm-graph-side { display: none; }
.tcm-timeline.is-graph .tcm-lanes, .tcm-timeline.is-graph .tcm-tl-row { display: none; }
.tcm-timeline.is-graph .tcm-tl-names { grid-auto-rows: auto; }
.tcm-timeline.is-graph .tcm-graph { display: block; }
.tcm-timeline.is-graph .tcm-graph-side { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 3px; padding: 6px 6px 0 0; }
.tcm-graph-svg { display: block; touch-action: none; overflow: visible; }
.tcm-grid { stroke: var(--tcm-line); stroke-width: 1; }
.tcm-key-line { stroke: var(--tcm-line); stroke-dasharray: 2 3; }
.tcm-curve { fill: none; stroke-width: 1.6; stroke-linejoin: round; }
.tcm-dot { stroke: var(--tcm-bg); stroke-width: 1.5; cursor: grab; }
.tcm-dot:hover { stroke: var(--tcm-fg); }
.tcm-dot.is-picked { stroke: var(--tcm-fg); stroke-width: 2; }
.tcm-graph-empty { fill: var(--tcm-dim); font: inherit; }
.tcm-graph-axis { fill: var(--tcm-dim); font: 9px ui-monospace, SFMono-Regular, Menlo, monospace; }
.tcm-chan {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border: 1px solid var(--tcm-line);
  border-radius: 4px;
  background: none;
  color: var(--tcm-dim);
  cursor: pointer;
}
.tcm-chan::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--tcm-chan, currentColor); opacity: 0.35; }
.tcm-chan[aria-pressed="true"] { color: var(--tcm-fg); border-color: color-mix(in srgb, var(--tcm-chan, var(--tcm-accent)) 55%, transparent); }
.tcm-chan[aria-pressed="true"]::before { opacity: 1; }
.tcm-chan--mode::before { display: none; }
.tcm-chan:focus-visible { outline: 1px solid var(--tcm-accent); }

/* Ease curve editor, in the key inspector */
.tcm-ease { display: flex; }
.tcm-ease svg { display: block; overflow: visible; touch-action: none; }
.tcm-ease:has(svg:empty) { display: none; }
.tcm-ease-box { fill: none; stroke: var(--tcm-line); }
.tcm-ease-curve { fill: none; stroke: var(--tcm-accent); stroke-width: 2; }
.tcm-ease-arm { stroke: var(--tcm-dim); stroke-width: 1; }
.tcm-ease-handle { fill: var(--tcm-accent); stroke: var(--tcm-bg); stroke-width: 1.5; cursor: grab; }
.tcm-ease-handle:hover { stroke: var(--tcm-fg); }
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
