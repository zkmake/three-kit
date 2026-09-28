/**
 * The ease curve editor: the move from the picked key to the next as a curve of progress over
 * time, CSS `cubic-bezier` style, with its two handles to drag. Reshaping a preset turns it into
 * a custom curve starting from the preset's shape. Handles go outside 0–1 upward and downward for
 * overshoot and anticipation; time stays in order (0–1).
 */
import { applyEase, type Bezier, type Keyframe, PRESET_BEZIERS } from "../core/track.ts";

const W = 132;
const H = 104;
/** The unit square's corners in the editor. */
const LEFT = 22;
const RIGHT = W - 12;
const TOP = 22;
const BOTTOM = H - 22;

const px = (x: number) => LEFT + x * (RIGHT - LEFT);
const py = (y: number) => BOTTOM - y * (BOTTOM - TOP);
const unx = (value: number) => (value - LEFT) / (RIGHT - LEFT);
const uny = (value: number) => (BOTTOM - value) / (BOTTOM - TOP);

const handlesOf = (key: Keyframe): Bezier | null => {
  if (key.ease === "hold") {
    return null;
  }

  return key.ease === "custom" ? (key.bezier ?? PRESET_BEZIERS.linear) : PRESET_BEZIERS[key.ease];
};

export const createEaseEditor = ({ onCommit }: { onCommit: (bezier: Bezier) => void }) => {
  const element = document.createElement("div");

  element.className = "tcm-ease";
  element.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Ease into the next key"></svg>`;

  const svg = element.querySelector("svg")!;
  let key: Keyframe | null = null;
  let hasNext = false;
  /** Handles being dragged, before they're committed. */
  let draft: Bezier | null = null;

  const paint = () => {
    if (!key) {
      svg.innerHTML = "";

      return;
    }

    if (!hasNext) {
      svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="tcm-graph-empty">last key: no move after it</text>`;

      return;
    }

    const handles = draft ?? handlesOf(key);
    const ease = draft ? "custom" : key.ease;
    const bezier = draft ?? key.bezier;
    const curve: string[] = [];

    for (let i = 0; i <= 48; i += 1) {
      const t = i / 48;

      curve.push(
        `${i === 0 ? "M" : "L"}${px(t).toFixed(1)} ${py(applyEase(ease, t, bezier)).toFixed(1)}`,
      );
    }

    // `hold` jumps at the end of its segment.
    if (ease === "hold") {
      curve.push(`L${px(1)} ${py(1)}`);
    }

    const box = `<rect class="tcm-ease-box" x="${LEFT}" y="${TOP}" width="${RIGHT - LEFT}" height="${BOTTOM - TOP}"/><line class="tcm-grid" x1="${px(0)}" y1="${py(0)}" x2="${px(1)}" y2="${py(1)}"/>`;
    const labels = `<text class="tcm-graph-axis" x="${LEFT}" y="${H - 8}">time</text><text class="tcm-graph-axis" x="4" y="${TOP - 8}">progress</text>`;
    const arms = handles
      ? `<line class="tcm-ease-arm" x1="${px(0)}" y1="${py(0)}" x2="${px(handles[0])}" y2="${py(handles[1])}"/><line class="tcm-ease-arm" x1="${px(1)}" y1="${py(1)}" x2="${px(handles[2])}" y2="${py(handles[3])}"/><circle class="tcm-ease-handle" data-handle="0" cx="${px(handles[0])}" cy="${py(handles[1])}" r="5"><title>Drag to reshape</title></circle><circle class="tcm-ease-handle" data-handle="1" cx="${px(handles[2])}" cy="${py(handles[3])}" r="5"><title>Drag to reshape</title></circle>`
      : "";

    svg.innerHTML = `${box}${labels}<path class="tcm-ease-curve" d="${curve.join("")}"/>${arms}`;
  };

  svg.addEventListener("pointerdown", (event) => {
    const handle = (event.target as SVGElement).dataset?.handle;

    if (!key || handle === undefined) {
      return;
    }

    const start = handlesOf(key);

    if (!start) {
      return;
    }

    event.preventDefault();
    svg.setPointerCapture(event.pointerId);
    draft = [...start];

    const box = svg.getBoundingClientRect();
    const scaleX = W / Math.max(box.width, 1);
    const scaleY = H / Math.max(box.height, 1);
    const index = handle === "0" ? 0 : 2;

    const onMove = (move: PointerEvent) => {
      const hx = unx((move.clientX - box.left) * scaleX);
      const hy = uny((move.clientY - box.top) * scaleY);

      draft![index] = Math.min(1, Math.max(0, hx));
      draft![index + 1] = Math.min(2, Math.max(-1, hy));
      paint();
    };
    const onUp = () => {
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onUp);

      const committed = draft!.map((value) => Math.round(value * 1000) / 1000) as Bezier;

      draft = null;
      onCommit(committed);
    };

    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
  });

  return {
    element,
    /** Whether a handle is being dragged: the timeline holds its rebuilds meanwhile. */
    get dragging() {
      return draft !== null;
    },
    set: (next: Keyframe | null, nextExists: boolean) => {
      key = next;
      hasNext = nextExists;

      if (!draft) {
        paint();
      }
    },
  };
};
