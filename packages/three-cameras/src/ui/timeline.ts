/**
 * The keyframe timeline: transport (to start, play/pause, release, loop, length), a ruler to
 * scrub, and two views. **Keys**: a lane per camera with its keys; drag a key to retime it (snaps
 * to 0.1 s, Shift for free), click one to inspect it, double-click a lane to key that camera
 * there, and toggle a camera's motion path in the scene. **Graph**: the picked camera's channels
 * over time (graph.ts). The inspector shows the picked key: its time, its ease into the next key
 * as a curve with handles to drag (ease-editor.ts), and update / delete.
 *
 * "Key" keys the picked camera at the playhead. Space plays and pauses while the timeline has
 * focus; Delete removes the picked key.
 */
import type { CameraEntry, CameraLab } from "../core/lab.ts";
import { EASES, type Ease, type Keyframe } from "../core/track.ts";
import { createEaseEditor } from "./ease-editor.ts";
import { createGraph } from "./graph.ts";
import { injectStyles } from "./styles.ts";

export type TimelinePanel = {
  element: HTMLElement;
  setTheme(theme: "dark" | "light"): void;
  dispose(): void;
};

type PickedKey = { camera: string; key: string };

/** Keys snap to this, s, unless Shift is held. */
const SNAP = 0.1;
/** A press that moves less than this, px, is a click. */
const DRAG_PX = 3;

const ICONS = {
  start: '<path d="M6 5v14"/><path d="M18 5 9 12l9 7Z"/>',
  play: '<path d="M7 4v16l13-8Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  loop: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  key: '<path d="M12 3 21 12 12 21 3 12Z"/>',
  trail:
    '<path d="M3 18c3-8 7-1 10-7s5-5 8-5"/><circle cx="3" cy="18" r="1.5"/><circle cx="21" cy="6" r="1.5"/>',
};

const EASE_LABELS: Record<Ease, string> = {
  "ease-in-out": "ease in-out",
  linear: "linear",
  "ease-in": "ease in",
  "ease-out": "ease out",
  hold: "hold",
  custom: "custom curve",
};

const svg = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

const icon = (action: string, paths: string, label: string) =>
  `<button type="button" class="tcm-icon" data-action="${action}" title="${label}" aria-label="${label}">${svg(paths)}</button>`;

const escape = (text: string) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

const seconds = (value: number) => value.toFixed(2);

/** Ruler steps: labelled every `major` s, a tick every `minor`. */
const rulerSteps = (duration: number) => {
  const major = duration <= 12 ? 1 : duration <= 30 ? 5 : duration <= 120 ? 10 : 30;

  return { major, minor: major / (major === 1 ? 4 : 5) };
};

export const createTimelinePanel = (lab: CameraLab): TimelinePanel => {
  injectStyles();

  const element = document.createElement("div");

  element.className = "tcm tcm-timeline";
  element.tabIndex = -1;
  element.innerHTML = `
    <div class="tcm-transport">
      ${icon("start", ICONS.start, "To the start")}
      <button type="button" class="tcm-icon tcm-play" data-action="play" title="Play (Space)" aria-label="Play">${svg(ICONS.play)}</button>
      ${icon("stop", ICONS.stop, "Stop, and let the cameras go")}
      ${icon("loop", ICONS.loop, "Loop")}
      <div class="tcm-modes" role="radiogroup" aria-label="View">
        <button type="button" role="radio" aria-checked="true" data-action="mode" data-mode="keys" title="Keys: a lane per camera">Keys</button>
        <button type="button" role="radio" aria-checked="false" data-action="mode" data-mode="graph" title="Graph: the picked camera's channels over time">Graph</button>
      </div>
      <span class="tcm-clock"></span>
      <label class="tcm-length" title="The timeline's length">length <input type="number" min="1" step="1" inputmode="decimal" /> s</label>
      <span class="tcm-spacer"></span>
      <button type="button" class="tcm-text-button tcm-add-key" data-action="add-key">${svg(ICONS.key)}<span>Key</span></button>
    </div>
    <div class="tcm-tl">
      <div class="tcm-tl-names"><div class="tcm-tl-corner"></div></div>
      <div class="tcm-tl-area">
        <div class="tcm-ruler" title="Drag to scrub"></div>
        <div class="tcm-lanes"></div>
        <div class="tcm-playhead"></div>
      </div>
    </div>
    <div class="tcm-inspector" hidden>
      <span class="tcm-inspector-title"></span>
      <label class="tcm-length">at <input type="number" min="0" step="0.1" data-key-field="time" inputmode="decimal" /> s</label>
      <span class="tcm-ease-slot"></span>
      <select data-key-field="ease" aria-label="Ease into the next key">${EASES.map((ease) => `<option value="${ease}">${EASE_LABELS[ease]}</option>`).join("")}</select>
      <span class="tcm-spacer"></span>
      <button type="button" class="tcm-text-button" data-action="key-update" title="Re-key it from the camera as it is now">Update</button>
      <button type="button" class="tcm-text-button" data-action="key-delete" title="Delete the key (Delete)">Delete</button>
    </div>
    <div class="tcm-empty tcm-tl-empty" hidden>Pick a camera and press Key, or double-click its lane, to start a track.</div>
    <div class="tcm-status" role="status"></div>
  `;

  const $ = <T extends Element>(selector: string) => element.querySelector<T>(selector)!;
  const playButton = $<HTMLButtonElement>('[data-action="play"]');
  const loopButton = $<HTMLButtonElement>('[data-action="loop"]');
  const clock = $<HTMLElement>(".tcm-clock");
  const lengthInput = $<HTMLInputElement>(".tcm-transport .tcm-length input");
  const addKey = $<HTMLButtonElement>('[data-action="add-key"]');
  const addKeyLabel = addKey.querySelector("span")!;
  const names = $<HTMLElement>(".tcm-tl-names");
  const area = $<HTMLElement>(".tcm-tl-area");
  const ruler = $<HTMLElement>(".tcm-ruler");
  const lanes = $<HTMLElement>(".tcm-lanes");
  const playhead = $<HTMLElement>(".tcm-playhead");
  const inspector = $<HTMLElement>(".tcm-inspector");
  const inspectorTitle = $<HTMLElement>(".tcm-inspector-title");
  const keyTime = $<HTMLInputElement>('[data-key-field="time"]');
  const keyEase = $<HTMLSelectElement>('[data-key-field="ease"]');
  const empty = $<HTMLElement>(".tcm-tl-empty");
  const status = $<HTMLElement>(".tcm-status");

  let picked: PickedKey | null = null;
  let dragging = false;
  let frame = 0;
  let rulerFor = -1;
  let mode: "keys" | "graph" = "keys";

  const say = (message: string) => {
    status.textContent = message;
  };

  const attempt = (work: () => void) => {
    try {
      say("");
      work();
    } catch (error) {
      say((error as Error).message.replace(/^three-cameras: /, ""));
    }
  };

  const tracked = () => lab.entries().filter((entry) => entry.projects);

  const graph = createGraph(lab, {
    camera: () => target(tracked())?.id ?? null,
    picked: () => picked,
    onPick: (next) => {
      picked = next;
      paintInspector();
    },
    onDrag: (active) => {
      dragging = active;

      if (!active) {
        render();
      }
    },
    say: (message) => say(message),
  });
  const ease = createEaseEditor({
    onCommit: (bezier) => {
      if (picked) {
        const { camera, key } = picked;

        attempt(() => lab.updateKey(camera, key, { bezier }));
      }
    },
  });

  names.append(graph.side);
  area.insertBefore(graph.plot, playhead);
  $<HTMLElement>(".tcm-ease-slot").replaceWith(ease.element);

  /** The camera "Key" acts on: the picked one, else the first that can be keyed. */
  const target = (entries: CameraEntry[]) =>
    entries.find((entry) => entry.selected) ?? entries[0] ?? null;

  const timeAt = (clientX: number) => {
    // The ruler spans the time axis in both views.
    const box = ruler.getBoundingClientRect();
    const share = box.width > 0 ? (clientX - box.left) / box.width : 0;

    return Math.min(1, Math.max(0, share)) * lab.timeline().duration;
  };

  const percent = (time: number) => `${(time / Math.max(lab.timeline().duration, 0.001)) * 100}%`;

  /** Playhead, clock and play button: every frame while playing, else on changes. */
  const paintClock = () => {
    const state = lab.timeline();

    playhead.style.left = percent(state.time);
    clock.textContent = `${seconds(state.time)} / ${seconds(state.duration)} s`;
    playButton.innerHTML = svg(state.playing ? ICONS.pause : ICONS.play);
    playButton.title = state.playing ? "Pause (Space)" : "Play (Space)";
    playButton.setAttribute("aria-label", state.playing ? "Pause" : "Play");
    element.classList.toggle("is-engaged", state.engaged);
    element.dispatchEvent(
      new CustomEvent("tcm-clock", {
        detail: `${seconds(state.time)} / ${seconds(state.duration)} s`,
      }),
    );

    if (state.playing && !frame) {
      const tick = () => {
        paintClock();
        frame = lab.timeline().playing ? requestAnimationFrame(tick) : 0;
      };

      frame = requestAnimationFrame(tick);
    }
  };

  const paintRuler = (duration: number) => {
    if (rulerFor === duration) {
      return;
    }

    rulerFor = duration;

    const { major, minor } = rulerSteps(duration);
    const ticks: string[] = [];

    for (let at = 0; at <= duration + 1e-6; at += minor) {
      const isMajor = Math.abs(at / major - Math.round(at / major)) < 1e-6;

      ticks.push(
        `<span class="tcm-tick${isMajor ? " is-major" : ""}" style="left:${(at / duration) * 100}%">${isMajor ? `<b>${Math.round(at)}</b>` : ""}</span>`,
      );
    }

    ruler.innerHTML = ticks.join("");
  };

  const pickedKey = (): Keyframe | null =>
    picked ? (lab.keys(picked.camera).find((key) => key.id === picked!.key) ?? null) : null;

  const paintInspector = () => {
    const key = pickedKey();

    inspector.hidden = !key;

    if (!key || !picked) {
      ease.set(null, false);

      return;
    }

    const keys = lab.keys(picked.camera);

    ease.set(key, keys.indexOf(key) < keys.length - 1);
    inspectorTitle.textContent = `${picked.camera} key`;

    if (document.activeElement !== keyTime) {
      keyTime.value = seconds(key.time);
    }

    keyEase.value = key.ease;
  };

  /** Lanes and keys, from the lab. Skipped mid-drag so the dragged key isn't rebuilt under the pointer. */
  const render = () => {
    if (dragging || ease.dragging) {
      return;
    }

    const state = lab.timeline();
    const entries = tracked();
    const aim = target(entries);

    paintRuler(state.duration);

    if (document.activeElement !== lengthInput) {
      lengthInput.value = String(Math.round(state.duration * 100) / 100);
    }

    loopButton.setAttribute("aria-pressed", String(state.loop));
    addKey.disabled = !aim;
    addKeyLabel.textContent = aim ? `Key ${aim.id}` : "Key";
    addKey.title = aim ? `Key ${aim.id} as it is now, at the playhead` : "No camera to key";

    element.classList.toggle("is-graph", mode === "graph");

    for (const button of element.querySelectorAll<HTMLElement>('[data-action="mode"]')) {
      button.setAttribute("aria-checked", String(button.dataset.mode === mode));
    }

    names.querySelectorAll(".tcm-tl-row").forEach((node) => node.remove());
    names.insertBefore(
      document.createRange().createContextualFragment(
        entries
          .map(
            (entry) => `<div class="tcm-tl-row">
              <button type="button" class="tcm-tl-name${entry.selected ? " is-selected" : ""}" data-camera="${escape(entry.id)}" title="Pick ${escape(entry.id)}">${escape(entry.id)}</button>
              <button type="button" class="tcm-icon tcm-trail" data-action="trail" data-camera="${escape(entry.id)}" aria-pressed="${entry.trail}" title="${entry.trail ? "Hide" : "Show"} its motion path in the scene" aria-label="${entry.trail ? "Hide" : "Show"} ${escape(entry.id)}'s motion path"${entry.keys === 0 ? " disabled" : ""}>${svg(ICONS.trail)}</button>
            </div>`,
          )
          .join(""),
      ),
      graph.side,
    );

    lanes.innerHTML = entries
      .map((entry) => {
        const keys = lab
          .keys(entry.id)
          .map((key) => {
            const isPicked = picked?.camera === entry.id && picked.key === key.id;

            return `<button type="button" class="tcm-key${isPicked ? " is-picked" : ""}${key.ease === "hold" ? " is-hold" : ""}" data-key="${escape(key.id)}" style="left:${percent(key.time)}" title="${seconds(key.time)} s · ${EASE_LABELS[key.ease]}" aria-label="${escape(entry.id)} key at ${seconds(key.time)} s"></button>`;
          })
          .join("");

        return `<div class="tcm-lane${entry.selected ? " is-selected" : ""}" data-camera="${escape(entry.id)}" title="Double-click to key ${escape(entry.id)} here">${keys}</div>`;
      })
      .join("");

    if (picked && !pickedKey()) {
      picked = null;
    }

    empty.hidden = mode === "graph" || entries.some((entry) => entry.keys > 0);
    paintInspector();
    paintClock();

    if (mode === "graph") {
      graph.paint();
    }
  };

  // Scrub on the ruler: press and drag.
  ruler.addEventListener("pointerdown", (event) => {
    ruler.setPointerCapture(event.pointerId);
    lab.seek(timeAt(event.clientX));

    const onMove = (move: PointerEvent) => lab.seek(timeAt(move.clientX));
    const onUp = () => {
      ruler.removeEventListener("pointermove", onMove);
      ruler.removeEventListener("pointerup", onUp);
      ruler.removeEventListener("pointercancel", onUp);
    };

    ruler.addEventListener("pointermove", onMove);
    ruler.addEventListener("pointerup", onUp);
    ruler.addEventListener("pointercancel", onUp);
  });

  // Keys: press to pick, drag to retime; a click also moves the playhead there.
  lanes.addEventListener("pointerdown", (event) => {
    const keyButton = (event.target as HTMLElement).closest<HTMLElement>(".tcm-key");
    const lane = (event.target as HTMLElement).closest<HTMLElement>(".tcm-lane");
    const camera = lane?.dataset.camera;

    if (!lane || !camera) {
      return;
    }

    if (!keyButton) {
      lab.select(camera);
      lab.seek(timeAt(event.clientX));

      return;
    }

    const keyId = keyButton.dataset.key!;
    const key = lab.keys(camera).find((other) => other.id === keyId);

    if (!key) {
      return;
    }

    // Hold rebuilds until the press ends, so the key under the pointer stays put.
    dragging = true;
    event.preventDefault();
    picked = { camera, key: keyId };
    lab.select(camera);
    keyButton.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const box = lanes.getBoundingClientRect();
    const duration = lab.timeline().duration;
    let moved = false;
    let time = key.time;

    const onMove = (move: PointerEvent) => {
      if (!moved && Math.abs(move.clientX - startX) < DRAG_PX) {
        return;
      }

      moved = true;

      const raw = key.time + ((move.clientX - startX) / Math.max(box.width, 1)) * duration;
      const snapped = move.shiftKey ? raw : Math.round(raw / SNAP) * SNAP;

      time = Math.min(duration, Math.max(0, snapped));
      keyButton.style.left = percent(time);
      keyButton.title = `${seconds(time)} s`;
    };
    const onUp = () => {
      keyButton.removeEventListener("pointermove", onMove);
      keyButton.removeEventListener("pointerup", onUp);
      keyButton.removeEventListener("pointercancel", onUp);
      dragging = false;

      if (moved) {
        attempt(() => lab.updateKey(camera, keyId, { time }));
      } else {
        lab.seek(key.time);
      }

      render();
    };

    keyButton.addEventListener("pointermove", onMove);
    keyButton.addEventListener("pointerup", onUp);
    keyButton.addEventListener("pointercancel", onUp);
  });

  lanes.addEventListener("dblclick", (event) => {
    const lane = (event.target as HTMLElement).closest<HTMLElement>(".tcm-lane");
    const camera = lane?.dataset.camera;

    if (camera && !(event.target as HTMLElement).closest(".tcm-key")) {
      attempt(() => {
        const key = lab.addKey(camera, { time: Math.round(timeAt(event.clientX) / SNAP) * SNAP });

        picked = { camera, key: key.id };
      });
    }
  });

  names.addEventListener("click", (event) => {
    const camera = (event.target as HTMLElement).closest<HTMLElement>(".tcm-tl-name")?.dataset
      .camera;

    if (camera) {
      lab.select(camera);
    }
  });

  element.addEventListener("click", (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset
      .action;
    const state = lab.timeline();

    if (action === "start") {
      lab.seek(0);
    } else if (action === "play") {
      if (state.playing) {
        lab.pause();
      } else {
        lab.play();
      }
    } else if (action === "stop") {
      lab.stop();
    } else if (action === "loop") {
      lab.setLoop(!state.loop);
    } else if (action === "mode") {
      const next = (event.target as HTMLElement).closest<HTMLElement>("[data-mode]")?.dataset.mode;

      mode = next === "graph" ? "graph" : "keys";
      render();
    } else if (action === "trail") {
      const camera = (event.target as HTMLElement).closest<HTMLElement>("[data-camera]")?.dataset
        .camera;
      const entry = camera ? lab.entry(camera) : null;

      if (camera && entry) {
        attempt(() => lab.setTrail(camera, !entry.trail));
      }
    } else if (action === "add-key") {
      const aim = target(tracked());

      if (aim) {
        attempt(() => {
          const key = lab.addKey(aim.id);

          picked = { camera: aim.id, key: key.id };
        });
      }
    } else if (action === "key-update" && picked) {
      const { camera, key } = picked;

      attempt(() => lab.updateKey(camera, key, { recapture: true }));
    } else if (action === "key-delete" && picked) {
      const { camera, key } = picked;

      picked = null;
      attempt(() => lab.deleteKey(camera, key));
    }
  });

  lengthInput.addEventListener("change", () => {
    const value = Number(lengthInput.value);

    if (Number.isFinite(value) && value > 0) {
      lab.setDuration(value);
    }
  });

  keyTime.addEventListener("change", () => {
    const value = Number(keyTime.value);

    if (picked && Number.isFinite(value) && value >= 0) {
      const { camera, key } = picked;

      attempt(() => lab.updateKey(camera, key, { time: value }));
    }
  });

  keyEase.addEventListener("change", () => {
    if (picked) {
      const { camera, key } = picked;

      attempt(() => lab.updateKey(camera, key, { ease: keyEase.value as Ease }));
    }
  });

  element.addEventListener("keydown", (event) => {
    const typing = (event.target as HTMLElement).closest("input, select, textarea");

    if (typing) {
      return;
    }

    if (event.key === " ") {
      event.preventDefault();

      if (lab.timeline().playing) {
        lab.pause();
      } else {
        lab.play();
      }
    } else if ((event.key === "Delete" || event.key === "Backspace") && picked) {
      const { camera, key } = picked;

      picked = null;
      attempt(() => lab.deleteKey(camera, key));
    }
  });

  // Clicking empty space in the panel gives it focus, so Space and Delete reach it.
  area.addEventListener("pointerdown", () => element.focus({ preventScroll: true }));

  const unsubscribe = lab.subscribe(render);

  render();

  return {
    element,
    setTheme: (theme) => {
      if (element.closest(".perf-hud__card")) {
        delete element.dataset.theme;
      } else {
        element.dataset.theme = theme;
      }
    },
    dispose: () => {
      cancelAnimationFrame(frame);
      graph.dispose();
      unsubscribe();
      element.remove();
    },
  };
};
