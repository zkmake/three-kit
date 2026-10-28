/** The overlay's stylesheet, injected once. Chips on a frosted pill, light or dark by the system. */
export const STUDIO_STYLES = /* css */ `
.tks {
  --tks-bg: rgba(22, 24, 29, 0.78);
  --tks-fg: #e6e8eb;
  --tks-dim: #9aa0aa;
  --tks-on-bg: #f2f3f5;
  --tks-on-fg: #16181d;
  --tks-pick: #ffe27a;
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  pointer-events: none;
  font: 12px/1.3 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  color: var(--tks-fg);
}
@media (prefers-color-scheme: light) {
  .tks {
    --tks-bg: rgba(250, 250, 252, 0.86);
    --tks-fg: #1a1c21;
    --tks-dim: #6b7079;
    --tks-on-bg: #1a1c21;
    --tks-on-fg: #f6f7f9;
    --tks-pick: #8a6d00;
  }
}
.tks *, .tks *::before, .tks *::after { box-sizing: border-box; }
.tks__col {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: calc(50vw - 18px);
}
.tks__col--start {
  top: calc(10px + env(safe-area-inset-top, 0px));
  left: calc(10px + env(safe-area-inset-left, 0px));
  align-items: flex-start;
}
.tks__col--end {
  top: calc(10px + env(safe-area-inset-top, 0px));
  right: calc(10px + env(safe-area-inset-right, 0px));
  align-items: flex-end;
}
.tks__row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 3px;
  border-radius: 9px;
  background: var(--tks-bg);
  backdrop-filter: blur(8px);
  pointer-events: auto;
}
.tks__col--end .tks__row { justify-content: flex-end; }
.tks__chip {
  padding: 4px 8px;
  border-radius: 6px;
  color: inherit;
  text-decoration: none;
  white-space: nowrap;
}
.tks__chip:hover { background: rgba(127, 127, 127, 0.18); }
.tks__chip:focus-visible { outline: 2px solid var(--tks-pick); outline-offset: 1px; }
.tks__chip[aria-current="true"] { background: var(--tks-on-bg); color: var(--tks-on-fg); }
.tks__row--variants .tks__chip[aria-current="true"] { box-shadow: inset 0 -2px 0 var(--tks-pick); }
.tks__stats {
  padding: 5px 9px;
  border-radius: 9px;
  background: var(--tks-bg);
  backdrop-filter: blur(8px);
  font-variant-numeric: tabular-nums;
  pointer-events: auto;
}
.tks__stats:empty { display: none; }
.tks__note { color: var(--tks-dim); }
`;

const STYLE_ID = "three-studio-styles";

export const injectStyles = (target: Document = document) => {
  if (target.getElementById(STYLE_ID)) {
    return;
  }

  const style = target.createElement("style");

  style.id = STYLE_ID;
  style.textContent = STUDIO_STYLES;
  target.head.append(style);
};
