/**
 * The graph editor: the picked camera's channels over time, drawn from the track as it plays (so
 * the path's bends and the eases show), with a dot per key per channel. Drag a dot up or down to
 * change that value in the key, or sideways to retime the key (the first few pixels pick which).
 * Click between keys to pick the segment there, double-click to add a key.
 *
 * Channels are stretched to their own ranges by default, so metres and degrees share one plot;
 * "values" draws them on one shared scale instead.
 */
import {
  CHANNEL_LABELS,
  type Channel,
  CHANNELS,
  readChannel,
  sampleChannel,
  writeChannel,
} from "../core/channels.ts";
import type { CameraLab } from "../core/lab.ts";
import type { Pose } from "../core/pose.ts";
import type { Keyframe } from "../core/track.ts";

export type PickedKey = { camera: string; key: string };

type GraphOptions = {
  /** The camera whose track is drawn. */
  camera: () => string | null;
  picked: () => PickedKey | null;
  onPick: (key: PickedKey | null) => void;
  /** A drag started or ended: the timeline holds its own rebuilds meanwhile. */
  onDrag: (dragging: boolean) => void;
  say: (message: string) => void;
};

type Scale = { min: number; max: number };

const HEIGHT = 150;
const PAD = 12;
const SNAP = 0.1;
const DRAG_PX = 4;

const COLORS: Record<Channel, string> = {
  px: "#f87171",
  py: "#4ade80",
  pz: "#60a5fa",
  rx: "#fca5a5",
  ry: "#86efac",
  rz: "#93c5fd",
  fov: "#fbbf24",
  zoom: "#fbbf24",
  near: "#c4b5fd",
  far: "#f0abfc",
};

const SHORT: Record<Channel, string> = {
  px: "x",
  py: "y",
  pz: "z",
  rx: "rx",
  ry: "ry",
  rz: "rz",
  fov: "fov",
  zoom: "zoom",
  near: "near",
  far: "far",
};

const trim = (value: number) => {
  const text = value.toFixed(Math.abs(value) >= 100 ? 0 : 2);

  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
};

/** An angle moved by whole turns to sit nearest `near`, so a key dot lands on its unwrapped curve. */
const nearestTurn = (value: number, near: number) => value + Math.round((near - value) / 360) * 360;

export const createGraph = (lab: CameraLab, options: GraphOptions) => {
  const side = document.createElement("div");
  const plot = document.createElement("div");

  side.className = "tcm-graph-side";
  plot.className = "tcm-graph";
  plot.innerHTML = `<svg class="tcm-graph-svg" height="${HEIGHT}" role="img" aria-label="Camera channels over time"></svg>`;

  const svg = plot.querySelector("svg")!;
  const visible = new Set<Channel>(["px", "py", "pz", "fov"]);
  let normalize = true;
  /** Scales held still during a drag, so the value under the pointer doesn't slide. */
  let frozen: Map<Channel, Scale> | null = null;
  let lastScales = new Map<Channel, Scale>();
  let width = 600;

  const keysOf = (): Keyframe[] => {
    const camera = options.camera();

    return camera ? lab.keys(camera) : [];
  };

  /** Channels this track has, fov only for a perspective camera. */
  const available = (keys: readonly Keyframe[]) =>
    CHANNELS.filter((channel) => keys.some((key) => readChannel(key.pose, channel) !== undefined));

  const shown = (keys: readonly Keyframe[]) => {
    const channels = available(keys).filter((channel) => visible.has(channel));

    return channels.length > 0 ? channels : available(keys).filter((channel) => channel === "zoom");
  };

  const x = (time: number) => (time / Math.max(lab.timeline().duration, 0.001)) * width;
  const y = (value: number, scale: Scale) =>
    HEIGHT -
    PAD -
    ((value - scale.min) / Math.max(scale.max - scale.min, 1e-9)) * (HEIGHT - 2 * PAD);

  const rangeOf = (values: number[]): Scale => {
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (max - min < 1e-6) {
      min -= 1;
      max += 1;
    }

    const pad = (max - min) * 0.08;

    return { min: min - pad, max: max + pad };
  };

  const paintSide = (keys: readonly Keyframe[]) => {
    const channels = available(keys);

    side.innerHTML = `${channels
      .map(
        (channel) =>
          `<button type="button" class="tcm-chan" data-channel="${channel}" aria-pressed="${visible.has(channel)}" style="--tcm-chan:${COLORS[channel]}" title="${CHANNEL_LABELS[channel]}">${SHORT[channel]}</button>`,
      )
      .join(
        "",
      )}<button type="button" class="tcm-chan tcm-chan--mode" data-graph-mode aria-pressed="${!normalize}" title="${normalize ? "Each channel stretched to its own range. Click for true values on one scale." : "True values on one scale. Click to stretch each channel to its own range."}">values</button>`;
  };

  const paint = () => {
    const keys = keysOf();
    const duration = lab.timeline().duration;

    width = Math.max(plot.clientWidth, 100);
    svg.setAttribute("width", String(width));
    svg.setAttribute("viewBox", `0 0 ${width} ${HEIGHT}`);
    paintSide(keys);

    if (keys.length === 0) {
      svg.innerHTML = `<text x="${width / 2}" y="${HEIGHT / 2}" text-anchor="middle" class="tcm-graph-empty">${options.camera() ? "No keys on this camera yet: press Key, or double-click here" : "Pick a camera to see its track"}</text>`;

      return;
    }

    const channels = shown(keys);
    const samples = Math.min(400, Math.max(40, Math.round(width / 3)));
    const curves = new Map(
      channels.map((channel) => [channel, sampleChannel(keys, channel, 0, duration, samples)]),
    );
    const scales = new Map<Channel, Scale>();

    if (frozen) {
      for (const [channel, scale] of frozen) {
        scales.set(channel, scale);
      }
    } else if (normalize) {
      for (const [channel, points] of curves) {
        scales.set(channel, rangeOf(points.map(([, value]) => value)));
      }
    } else {
      const all = rangeOf(
        [...curves.values()].flatMap((points) => points.map(([, value]) => value)),
      );

      for (const channel of channels) {
        scales.set(channel, all);
      }
    }

    lastScales = scales;

    const picked = options.picked();
    const grid = [0.25, 0.5, 0.75]
      .map((share) => {
        const at = PAD + share * (HEIGHT - 2 * PAD);

        return `<line class="tcm-grid" x1="0" x2="${width}" y1="${at}" y2="${at}"/>`;
      })
      .join("");
    const shared = !normalize && channels[0] ? scales.get(channels[0]) : null;
    const axis = shared
      ? `<text class="tcm-graph-axis" x="4" y="${PAD + 9}">${trim(shared.max)}</text><text class="tcm-graph-axis" x="4" y="${HEIGHT - PAD - 3}">${trim(shared.min)}</text>`
      : "";
    const keyLines = keys
      .map(
        (key) =>
          `<line class="tcm-key-line" x1="${x(key.time)}" x2="${x(key.time)}" y1="0" y2="${HEIGHT}"/>`,
      )
      .join("");
    const lines = channels
      .map((channel) => {
        const scale = scales.get(channel)!;
        const d = curves
          .get(channel)!
          .map(
            ([time, value], index) =>
              `${index === 0 ? "M" : "L"}${x(time).toFixed(1)} ${y(value, scale).toFixed(1)}`,
          )
          .join("");

        return `<path class="tcm-curve" d="${d}" stroke="${COLORS[channel]}"/>`;
      })
      .join("");
    const dots = channels
      .flatMap((channel) => {
        const scale = scales.get(channel)!;
        const points = curves.get(channel)!;

        return keys.map((key) => {
          let value = readChannel(key.pose, channel)!;

          if (channel.startsWith("r")) {
            const near = points.reduce((best, point) =>
              Math.abs(point[0] - key.time) < Math.abs(best[0] - key.time) ? point : best,
            );

            value = nearestTurn(value, near[1]);
          }

          const isPicked = picked?.key === key.id;

          return `<circle class="tcm-dot${isPicked ? " is-picked" : ""}" cx="${x(key.time)}" cy="${y(value, scale)}" r="${isPicked ? 5 : 4}" fill="${COLORS[channel]}" data-key="${key.id}" data-channel="${channel}" data-value="${value}"><title>${CHANNEL_LABELS[channel]} ${trim(value)} at ${key.time.toFixed(2)} s</title></circle>`;
        });
      })
      .join("");

    svg.innerHTML = grid + axis + keyLines + lines + dots;
  };

  side.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("button");

    if (!button) {
      return;
    }

    if (button.dataset.graphMode !== undefined) {
      normalize = !normalize;
    } else {
      const channel = button.dataset.channel as Channel;

      if (visible.has(channel)) {
        visible.delete(channel);
      } else {
        visible.add(channel);
      }
    }

    paint();
  });

  const timeAt = (clientX: number) => {
    const box = svg.getBoundingClientRect();

    return (
      Math.min(1, Math.max(0, (clientX - box.left) / Math.max(box.width, 1))) *
      lab.timeline().duration
    );
  };

  svg.addEventListener("pointerdown", (event) => {
    const camera = options.camera();
    const target = event.target as Element;

    if (!camera) {
      return;
    }

    const keys = lab.keys(camera);

    if (!target.classList.contains("tcm-dot")) {
      const time = timeAt(event.clientX);
      const segment = [...keys].reverse().find((key) => key.time <= time) ?? null;

      options.onPick(segment ? { camera, key: segment.id } : null);
      lab.seek(time);

      return;
    }

    const keyId = (target as SVGElement).dataset.key!;
    const channel = (target as SVGElement).dataset.channel as Channel;
    const startValue = Number((target as SVGElement).dataset.value);
    const key = keys.find((other) => other.id === keyId);

    if (!key) {
      return;
    }

    event.preventDefault();
    svg.setPointerCapture(event.pointerId);
    options.onPick({ camera, key: keyId });
    options.onDrag(true);
    frozen = new Map(lastScales);
    lab.seek(key.time);

    const startX = event.clientX;
    const startY = event.clientY;
    const startPose: Pose = key.pose;
    const duration = lab.timeline().duration;
    const scale = frozen.get(channel) ?? { min: 0, max: 1 };
    let axis: "time" | "value" | null = null;

    const onMove = (move: PointerEvent) => {
      const dx = move.clientX - startX;
      const dy = move.clientY - startY;

      if (!axis) {
        if (Math.hypot(dx, dy) < DRAG_PX) {
          return;
        }

        axis = Math.abs(dx) > Math.abs(dy) ? "time" : "value";
      }

      try {
        if (axis === "time") {
          const raw = key.time + (dx / width) * duration;
          const time = Math.min(
            duration,
            Math.max(0, move.shiftKey ? raw : Math.round(raw / SNAP) * SNAP),
          );

          lab.updateKey(camera, keyId, { time });
          lab.seek(time);
        } else {
          const perPixel = (scale.max - scale.min) / (HEIGHT - 2 * PAD);
          const value = startValue - dy * perPixel * (move.shiftKey ? 0.1 : 1);

          lab.updateKey(camera, keyId, { pose: writeChannel(startPose, channel, value) });
        }

        paint();
      } catch (error) {
        options.say((error as Error).message.replace(/^three-cameras: /, ""));
      }
    };
    const onUp = () => {
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onUp);
      frozen = null;
      options.onDrag(false);
      paint();
    };

    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
  });

  svg.addEventListener("dblclick", (event) => {
    const camera = options.camera();

    if (camera && !(event.target as Element).classList.contains("tcm-dot")) {
      try {
        const key = lab.addKey(camera, { time: Math.round(timeAt(event.clientX) / SNAP) * SNAP });

        options.onPick({ camera, key: key.id });
      } catch (error) {
        options.say((error as Error).message.replace(/^three-cameras: /, ""));
      }
    }
  });

  const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => paint());

  resize?.observe(plot);

  return {
    side,
    plot,
    paint,
    dispose: () => {
      resize?.disconnect();
    },
  };
};
