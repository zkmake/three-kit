/**
 * `CameraLab`: the cameras a scene has and the ones drawing it. No UI; the panel drives it.
 *
 * Cameras come from two places: the scene graph, and the renderer. The camera an app renders with
 * is often not in the scene at all (R3F's default camera isn't; most vanilla apps never add
 * theirs), so the lab wraps `renderer.render` and notes every camera it's handed: that's how it
 * knows which are live, and how often each draws.
 *
 * Entries are named by the `cameras` option, else the camera's name, else its kind, numbered when
 * they repeat. A name holds for as long as the camera is listed, and saved views are kept by it.
 *
 * The same watch lets the lab act on frames: "look through" hands the renderer another camera in
 * place of the app's main one (fitted to its aspect for that frame), a move to a saved view steps
 * once per frame, and the timeline plays: each camera with keyframes is put where its track says,
 * right before the frame draws, so it wins over an app that moves the camera itself.
 *
 * Once the timeline has been played or scrubbed, tracked cameras are held to their tracks, even
 * paused. Editing one (`set`, a move to a saved view) lets it go, so the edit sticks until it's
 * keyed or the timeline moves again; `stop()` lets them all go.
 */
import {
  BufferGeometry,
  type Camera,
  CameraHelper,
  Euler,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Matrix4,
  type Object3D,
  type OrthographicCamera,
  type PerspectiveCamera,
  Points,
  PointsMaterial,
  Quaternion,
  Vector3,
  Vector4,
} from "three";

import {
  type CameraKind,
  findCameras,
  isCamera,
  kindOf,
  pathOf,
  type SceneCamera,
} from "./discover.ts";
import { applyPose, blendPoses, capturePose, easeInOut, type Pose } from "./pose.ts";
import {
  type Bezier,
  type Ease,
  type Keyframe,
  PRESET_BEZIERS,
  sampleTrack,
  sortKeys,
} from "./track.ts";

export type CameraInfo = {
  name: string;
  camera: SceneCamera;
};

/** The part of a renderer the lab needs: `render(scene, camera)`. */
export type RendererLike = {
  render: (scene: Object3D, camera: Camera, ...rest: never[]) => unknown;
};

export type CameraLabOptions = {
  /** Where to look for cameras, and where frustum helpers go. */
  scene: Object3D;
  /** A three renderer: its `render` is watched, so cameras outside the scene show up and live ones are marked. */
  renderer?: unknown;
  /** Cameras to list whether or not the scene holds them yet, with names. */
  cameras?: readonly CameraInfo[];
  /** Ask for a frame, for render-on-demand loops (R3F `frameloop="demand"`). */
  invalidate?: () => void;
  /** Where saved views live. Default: this page only. */
  store?: ViewStore;
  /** Where keyframe tracks live. Default: this page only. */
  trackStore?: TrackStore;
};

/** A pose saved on a camera, to go back to. */
export type SavedView = {
  id: string;
  name: string;
  pose: Pose;
};

/** Saved views by camera name. `mountCameraPanel` keeps them in localStorage. */
export type ViewStore = {
  load(): Record<string, SavedView[]>;
  save(views: Record<string, SavedView[]>): void;
};

/** Keyframe tracks by camera name, and the timeline's length. */
export type TrackStore = {
  load(): { duration?: number; tracks: Record<string, Keyframe[]> };
  save(data: { duration: number; tracks: Record<string, Keyframe[]> }): void;
};

export type TimelineState = {
  /** The playhead, seconds. */
  time: number;
  /** Seconds. */
  duration: number;
  playing: boolean;
  loop: boolean;
  /** Tracked cameras are held to their tracks (after a play or a scrub, until `stop`). */
  engaged: boolean;
};

/** Values to set on a camera. Position and rotation are its own (local); rotation in degrees. */
export type CameraPatch = {
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  fov?: number;
  near?: number;
  far?: number;
  zoom?: number;
};

export type CameraEntry = {
  id: string;
  kind: CameraKind;
  camera: SceneCamera;
  /** Under the lab's scene. A camera only the renderer knows about isn't. */
  inScene: boolean;
  /** Drew a frame in the last half second. */
  live: boolean;
  /** Frames drawn with it in the last second. */
  fps: number;
  /** Its frustum helper is showing. */
  helper: boolean;
  /** A frustum helper can draw it: perspective and orthographic cameras. */
  canHelp: boolean;
  /** Its ancestors, root first. */
  path: string[];
  /** Perspective or orthographic: its lens can be edited, looked through and saved. */
  projects: boolean;
  /** The main view shows through it now. */
  viewing: boolean;
  /** The app's camera that it's standing in for, while another is looked through. */
  standingIn: boolean;
  /** Saved views on it. */
  views: number;
  /** Keyframes on its track. */
  keys: number;
  /** Its motion path is drawn in the scene. */
  trail: boolean;
  /** It moved in the last second: the app animates it, or its track plays. */
  moving: boolean;
  /** Its recent moves are recorded, to draw or to bake into keys. */
  recorded: boolean;
  /** Picked in a panel: the camera "add key" and the controls act on. */
  selected: boolean;
};

export type Projection = {
  near: number;
  far: number;
  zoom: number;
  /** Perspective: vertical field of view in degrees, and aspect. */
  fov?: number;
  aspect?: number;
  /** Orthographic: the frustum's sides. */
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
};

export type CameraDetails = {
  /** World position. */
  position: [number, number, number];
  /** World rotation, XYZ Euler in degrees. */
  rotation: [number, number, number];
  /** Its own position and rotation (degrees), relative to its parent: what `set` changes. */
  local: {
    position: [number, number, number];
    rotation: [number, number, number];
  };
  projection: Projection | null;
};

type Tween = { from: Pose; to: Pose; start: number; duration: number };

type Item = {
  id: string;
  camera: SceneCamera;
  kind: CameraKind;
  helper: CameraHelper | null;
  /** When each of the last second's frames drew, ms. */
  frames: number[];
  /** Screen pixels its last frame drew into; 0 for a render target. How the main view is told apart. */
  area: number;
  /** Held to its track while the timeline is engaged; an edit lets it go. */
  held: boolean;
  /** Its motion path in the scene: the track line, the key markers, and the recorded line. */
  trail: Group | null;
  /** `auto`: drawn while it moves or has keys (in the scene). `on` / `off`: as set. */
  trailMode: "auto" | "on" | "off";
  /** Where it's been lately (its own position and rotation), oldest first. */
  motion: MotionSample[];
  /** When it last moved, ms. */
  lastMoved: number;
  /** When its recorded line was last redrawn, ms. */
  motionDrawn: number;
};

/** A recorded moment of a camera's motion: when, and its own position and rotation. */
export type MotionSample = {
  /** ms, on the lab's clock. */
  time: number;
  position: [number, number, number];
  quaternion: [number, number, number, number];
};

/** The main view as last drawn: for turning screen points into rays (dragging path handles). */
export type ViewTransform = {
  /** The camera's world matrix. */
  world: Matrix4;
  projection: Matrix4;
  /** x, y, width, height in drawing-buffer pixels, y from the bottom. */
  viewport: Vector4;
};

/** How long a camera's moves are kept, ms, and at most how many samples. */
const RECORD_MS = 8000;
const RECORD_MAX = 900;
/** Moved this recently counts as moving, ms. */
const MOVING_MS = 1000;
/** Less than this, in its own units, isn't a move. */
const STILL = 1e-4;
/** How often a recorded line redraws, ms. */
const MOTION_REDRAW_MS = 100;

/** Path points per second of track, and the most a path gets. */
const TRAIL_RATE = 30;
const TRAIL_MAX = 600;

/** What the lab reads off a WebGL or WebGPU renderer, when it has them. */
type Viewported = {
  getCurrentViewport?: (target: Vector4) => Vector4;
  getRenderTarget?: () => unknown;
};

/** Rendered this recently counts as live, ms. */
const LIVE_MS = 500;
/** A camera outside the scene stays listed this long after its last frame, ms. */
const KEEP_MS = 5000;
/** A move to a saved view, ms. */
const MOVE_MS = 800;
/** A new timeline's length, s. */
const DURATION_S = 10;
/** Keys closer than this, s, are the same key. */
const SAME_TIME = 1e-3;

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const memoryTracks = (): TrackStore => {
  let data: ReturnType<TrackStore["load"]> = { tracks: {} };

  return {
    load: () => data,
    save: (next) => {
      data = next;
    },
  };
};

const memoryViews = (): ViewStore => {
  let views: Record<string, SavedView[]> = {};

  return {
    load: () => views,
    save: (next) => {
      views = next;
    },
  };
};

const KIND_LABELS: Record<CameraKind, string> = {
  perspective: "perspective",
  orthographic: "orthographic",
  array: "array",
  cube: "cube",
  other: "camera",
};

const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());

const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const projectionOf = (camera: SceneCamera, kind: CameraKind): Projection | null => {
  if (kind === "perspective" || kind === "array") {
    const { near, far, zoom, fov, aspect } = camera as PerspectiveCamera;

    return { near, far, zoom, fov, aspect };
  }

  if (kind === "orthographic") {
    const { near, far, zoom, left, right, top, bottom } = camera as OrthographicCamera;

    return { near, far, zoom, left, right, top, bottom };
  }

  return null;
};

/** Ramer–Douglas–Peucker on positions: the samples where the path bends by more than `tolerance`. */
const simplify = (samples: MotionSample[], tolerance: number, maxKeys: number): MotionSample[] => {
  const keep = new Set<number>([0, samples.length - 1]);
  const a = new Vector3();
  const b = new Vector3();
  const p = new Vector3();

  const distance = (index: number, from: number, to: number) => {
    a.fromArray(samples[from]!.position);
    b.fromArray(samples[to]!.position);
    p.fromArray(samples[index]!.position);

    const span = b.clone().sub(a);
    const length = span.lengthSq();

    if (length === 0) {
      return p.distanceTo(a);
    }

    const t = Math.min(1, Math.max(0, p.clone().sub(a).dot(span) / length));

    return p.distanceTo(a.clone().addScaledVector(span, t));
  };

  const split = (from: number, to: number) => {
    let far = -1;
    let most = tolerance;

    for (let i = from + 1; i < to; i += 1) {
      const d = distance(i, from, to);

      if (d > most) {
        most = d;
        far = i;
      }
    }

    if (far >= 0 && keep.size < maxKeys) {
      keep.add(far);
      split(from, far);
      split(far, to);
    }
  };

  split(0, samples.length - 1);

  return [...keep].sort((x, y) => x - y).map((index) => samples[index]!);
};

export class CameraLab {
  private readonly options: CameraLabOptions;
  private readonly records = new Map<SceneCamera, Item>();
  private readonly byId = new Map<string, Item>();
  private readonly listeners = new Set<() => void>();
  private readonly tweens = new Map<Item, Tween>();
  private readonly store: ViewStore;
  private saved: Record<string, SavedView[]>;
  private restoreRender: (() => void) | null = null;
  /** Look-through: the camera shown, and the app camera it stands in for. */
  private looking: Item | null = null;
  private standIn: Camera | null = null;
  /** The frame being drawn: what to put back after it. */
  private fitted: { camera: PerspectiveCamera; aspect: number } | null = null;
  private readonly viewport = new Vector4();
  private view: ViewTransform | null = null;
  private readonly trackStore: TrackStore;
  private tracks: Record<string, Keyframe[]>;
  private readonly state: TimelineState;
  /** When the playhead last advanced, ms; `null` until the next frame after a play. */
  private lastTick: number | null = null;
  private selectedId: string | null = null;
  private notifyQueued = false;
  private disposed = false;

  constructor(options: CameraLabOptions) {
    this.options = options;
    this.store = options.store ?? memoryViews();
    this.saved = { ...this.store.load() };
    this.trackStore = options.trackStore ?? memoryTracks();

    const loaded = this.trackStore.load();

    this.tracks = { ...loaded.tracks };
    this.state = {
      time: 0,
      duration: loaded.duration && loaded.duration > 0 ? loaded.duration : DURATION_S,
      playing: false,
      loop: true,
      engaged: false,
    };
    this.watch(options.renderer);
    this.refresh();
  }

  /** Whether the lab sees frames: look-through and animated moves need a renderer. */
  get watching() {
    return this.restoreRender !== null;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Every camera, in scene order; ones only the renderer knows about after. */
  entries(): CameraEntry[] {
    const time = now();

    return [...this.byId.values()].map((item) => this.entryOf(item, time));
  }

  entry(id: string): CameraEntry | null {
    const item = this.byId.get(id);

    return item ? this.entryOf(item, now()) : null;
  }

  /** Where it is and how it projects, read now. */
  details(id: string): CameraDetails | null {
    const item = this.byId.get(id);

    if (!item) {
      return null;
    }

    const { camera } = item;
    const position = new Vector3();
    const quaternion = new Quaternion();

    camera.updateWorldMatrix(true, false);
    camera.matrixWorld.decompose(position, quaternion, new Vector3());

    const euler = new Euler().setFromQuaternion(quaternion);
    const own = camera.rotation;

    return {
      position: [position.x, position.y, position.z],
      rotation: [toDegrees(euler.x), toDegrees(euler.y), toDegrees(euler.z)],
      local: {
        position: [camera.position.x, camera.position.y, camera.position.z],
        rotation: [toDegrees(own.x), toDegrees(own.y), toDegrees(own.z)],
      },
      projection: projectionOf(camera, item.kind),
    };
  }

  /**
   * Change a camera: its own position or rotation, or its lens. The projection updates, and a
   * render-on-demand loop gets a frame. An app that sets the camera every frame wins on the next.
   */
  set(id: string, patch: CameraPatch) {
    const item = this.require(id);
    const camera = item.camera;

    if (patch.position) {
      camera.position.set(...patch.position);
    }

    if (patch.rotation) {
      const [x, y, z] = patch.rotation.map(toRadians) as [number, number, number];

      camera.rotation.set(x, y, z);
    }

    if (this.projects(item)) {
      const lens = camera as PerspectiveCamera | OrthographicCamera;

      if (patch.near !== undefined) {
        lens.near = patch.near;
      }

      if (patch.far !== undefined) {
        lens.far = patch.far;
      }

      if (patch.zoom !== undefined) {
        lens.zoom = patch.zoom;
      }

      if (patch.fov !== undefined && item.kind === "perspective") {
        (lens as PerspectiveCamera).fov = patch.fov;
      }

      lens.updateProjectionMatrix();
    }

    this.tweens.delete(item);
    item.held = false;
    this.options.invalidate?.();
  }

  /** The camera picked in a panel, which "add key" and the controls act on. */
  get selected() {
    return this.selectedId;
  }

  select(id: string | null) {
    if (id !== this.selectedId && (id === null || this.byId.has(id))) {
      this.selectedId = id;
      this.notify();
    }
  }

  /**
   * Show the main view through `id`, or back through the app's own camera with `null`. The camera
   * it stands in for is the app's main view: the one drawing the most of the screen (a
   * picture-in-picture inset or a render target loses to it), most often on a tie.
   */
  lookThrough(id: string | null) {
    if (id === null || this.looking?.id === id) {
      this.looking = null;
      this.standIn = null;
    } else {
      const item = this.require(id);

      if (!this.projects(item)) {
        throw new Error(`three-cameras: "${id}" can't be looked through (${item.kind})`);
      }

      const time = now();
      const main = [...this.records.values()]
        .filter((other) => other !== item && isCamera(other.camera))
        .map((other) => ({ other, fps: other.frames.filter((at) => time - at <= 1000).length }))
        .filter(({ fps }) => fps > 0)
        .sort((a, b) => b.other.area - a.other.area || b.fps - a.fps)[0];

      if (!main) {
        throw new Error("three-cameras: no camera is drawing, so there's no view to look through");
      }

      this.looking = item;
      this.standIn = main.other.camera as Camera;
    }

    this.options.invalidate?.();
    this.notify();
  }

  /** Save where the camera is and how it projects, as a view to go back to. */
  saveView(id: string, name?: string): SavedView {
    const item = this.require(id);

    if (!this.projects(item)) {
      throw new Error(`three-cameras: "${id}" has no lens to save (${item.kind})`);
    }

    const list = this.saved[id] ?? [];
    const taken = new Set(list.map((view) => view.name));
    let label = name ?? `view ${list.length + 1}`;

    for (let n = 2; taken.has(label); n += 1) {
      label = `${name ?? "view"} ${n}`;
    }

    const view: SavedView = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: label,
      pose: capturePose(item.camera as Camera),
    };

    this.saved = { ...this.saved, [id]: [...list, view] };
    this.store.save(this.saved);
    this.notify();

    return view;
  }

  views(id: string): SavedView[] {
    return this.saved[id] ?? [];
  }

  deleteView(id: string, viewId: string) {
    const list = this.saved[id] ?? [];

    this.saved = { ...this.saved, [id]: list.filter((view) => view.id !== viewId) };
    this.store.save(this.saved);
    this.notify();
  }

  /**
   * Move the camera to a saved view: eased over `duration` ms, stepped once per frame (so it needs
   * a renderer; without one, or with `duration: 0`, it lands at once).
   */
  goToView(id: string, viewId: string, { duration = MOVE_MS }: { duration?: number } = {}) {
    const item = this.require(id);
    const view = this.views(id).find((saved) => saved.id === viewId);

    if (!view) {
      throw new Error(`three-cameras: "${id}" has no saved view "${viewId}"`);
    }

    const camera = item.camera as Camera;

    item.held = false;

    if (duration <= 0 || !this.watching) {
      this.tweens.delete(item);
      applyPose(camera, view.pose);
    } else {
      this.tweens.set(item, { from: capturePose(camera), to: view.pose, start: now(), duration });
    }

    this.options.invalidate?.();
  }

  // Timeline ---------------------------------------------------------------------------------

  timeline(): TimelineState {
    return { ...this.state };
  }

  /** Play from the playhead (from the start if it's at the end). Needs a renderer to advance. */
  play() {
    if (this.state.time >= this.state.duration) {
      this.state.time = 0;
    }

    this.state.playing = true;
    this.lastTick = null;
    this.engage();
  }

  pause() {
    this.state.playing = false;
    this.notify();
  }

  /** Stop and let every camera go back to the app (and to edits). The playhead stays. */
  stop() {
    this.state.playing = false;
    this.state.engaged = false;
    this.notify();
  }

  /** Move the playhead, and hold tracked cameras where their tracks are then. */
  seek(time: number) {
    this.state.time = Math.min(Math.max(0, time), this.state.duration);
    this.lastTick = null;
    this.engage();
  }

  setLoop(loop: boolean) {
    this.state.loop = loop;
    this.notify();
  }

  /** The timeline's length, s. Keys past it stay, and it grows to fit a key added later. */
  setDuration(duration: number) {
    if (duration > 0) {
      this.state.duration = duration;
      this.state.time = Math.min(this.state.time, duration);
      this.saveTracks();
      this.notify();
    }
  }

  /** A camera's keyframes, in time order. */
  keys(id: string): Keyframe[] {
    return this.tracks[id] ?? [];
  }

  /**
   * Key the camera as it is now, at `time` (default: the playhead). A key already there is
   * replaced, keeping its ease.
   */
  addKey(id: string, { time, ease }: { time?: number; ease?: Ease } = {}): Keyframe {
    const item = this.require(id);

    if (!this.projects(item)) {
      throw new Error(`three-cameras: "${id}" has no lens to key (${item.kind})`);
    }

    const at = Math.max(0, time ?? this.state.time);
    const list = this.keys(id);
    const existing = list.find((key) => Math.abs(key.time - at) < SAME_TIME);
    const key: Keyframe = {
      id: existing?.id ?? newId(),
      time: at,
      pose: capturePose(item.camera as Camera),
      ease: ease ?? existing?.ease ?? "ease-in-out",
    };

    this.setTrack(id, [...list.filter((other) => other !== existing), key]);

    if (at > this.state.duration) {
      this.state.duration = Math.ceil(at);
    }

    item.held = true;
    this.state.engaged = true;
    this.saveTracks();
    this.notify();

    return key;
  }

  /**
   * Change a key: move it in time, change its ease or its curve (`bezier`, which makes the ease
   * `custom`), set its pose outright (a graph editor's drag), or re-key it from the camera as it is.
   */
  updateKey(
    id: string,
    keyId: string,
    change: { time?: number; ease?: Ease; bezier?: Bezier; pose?: Pose; recapture?: boolean },
  ) {
    const item = this.require(id);
    const key = this.keys(id).find((other) => other.id === keyId);

    if (!key) {
      throw new Error(`three-cameras: "${id}" has no key "${keyId}"`);
    }

    const ease = change.bezier ? "custom" : (change.ease ?? key.ease);
    const next: Keyframe = {
      ...key,
      time: change.time === undefined ? key.time : Math.max(0, change.time),
      ease,
      pose: change.recapture ? capturePose(item.camera as Camera) : (change.pose ?? key.pose),
    };

    if (ease === "custom") {
      // Custom from a preset starts from the preset's shape.
      next.bezier =
        change.bezier ??
        key.bezier ??
        (key.ease === "custom" || key.ease === "hold"
          ? PRESET_BEZIERS.linear
          : PRESET_BEZIERS[key.ease]);
    } else {
      delete next.bezier;
    }

    this.setTrack(
      id,
      this.keys(id).map((other) => (other === key ? next : other)),
    );

    if (change.recapture) {
      item.held = true;
    }

    this.saveTracks();
    this.options.invalidate?.();
    this.notify();
  }

  deleteKey(id: string, keyId: string) {
    this.setTrack(
      id,
      this.keys(id).filter((key) => key.id !== keyId),
    );
    this.saveTracks();
    this.notify();
  }

  private setTrack(id: string, keys: Keyframe[]) {
    const next = { ...this.tracks };

    if (keys.length > 0) {
      next[id] = sortKeys(keys);
    } else {
      delete next[id];
    }

    this.tracks = next;

    const item = this.byId.get(id);

    if (item) {
      this.syncTrail(item);
    }
  }

  /**
   * Show or hide a camera's motion path in the scene, or `auto` (the default): shown while it
   * moves or has keys, for cameras in the scene. The path is its track as a line with a dot per
   * key; a camera without keys shows where it's been lately instead.
   */
  setTrail(id: string, on: boolean | "auto") {
    const item = this.require(id);

    item.trailMode = on === "auto" ? "auto" : on ? "on" : "off";
    this.syncTrail(item);
    this.options.invalidate?.();
    this.notify();
  }

  /** Where the camera has been lately, oldest first. */
  motion(id: string): MotionSample[] {
    return [...this.require(id).motion];
  }

  /**
   * Turn a camera's recorded moves into keys, replacing its track: a key where the path bends
   * (within `tolerance`, in its own units), timed from the first sample, linear between. The
   * lens is the camera's as it is now.
   */
  bakeMotion(
    id: string,
    { tolerance = 0.05, maxKeys = 40 }: { tolerance?: number; maxKeys?: number } = {},
  ) {
    const item = this.require(id);

    if (!this.projects(item)) {
      throw new Error(`three-cameras: "${id}" has no lens to key (${item.kind})`);
    }

    const samples = item.motion;

    if (samples.length < 2) {
      throw new Error(`three-cameras: "${id}" hasn't moved lately, so there's nothing to bake`);
    }

    const picked = simplify(samples, tolerance, maxKeys);
    const start = samples[0]!.time;
    const lens = capturePose(item.camera as Camera);
    const keys: Keyframe[] = picked.map((sample) => ({
      id: newId(),
      time: Math.round(((sample.time - start) / 1000) * 1000) / 1000,
      pose: { ...lens, position: [...sample.position], quaternion: [...sample.quaternion] },
      ease: "linear",
    }));

    this.setTrack(id, keys);
    this.state.duration = Math.max(this.state.duration, Math.ceil(keys.at(-1)!.time));
    this.saveTracks();
    this.syncTrail(item);
    this.notify();

    return keys;
  }

  /** The main view as last drawn, or `null` before its first frame. */
  viewTransform(): ViewTransform | null {
    return this.view
      ? {
          world: this.view.world.clone(),
          projection: this.view.projection.clone(),
          viewport: this.view.viewport.clone(),
        }
      : null;
  }

  /** Every key dot drawn in the scene, where it is in the world. */
  keyHandles(): { camera: string; key: string; position: Vector3 }[] {
    const handles: { camera: string; key: string; position: Vector3 }[] = [];

    for (const item of this.records.values()) {
      const keys = this.tracks[item.id];

      if (!item.trail || !keys) {
        continue;
      }

      const parent = item.camera.parent;

      parent?.updateWorldMatrix(true, false);

      for (const key of keys) {
        const position = new Vector3().fromArray(key.pose.position);

        if (parent) {
          position.applyMatrix4(parent.matrixWorld);
        }

        handles.push({ camera: item.id, key: key.id, position });
      }
    }

    return handles;
  }

  /** Move a key to a point in the world (a dragged dot): its position, in the camera's parent's space. */
  moveKeyTo(id: string, keyId: string, world: Vector3) {
    const item = this.require(id);
    const key = this.keys(id).find((other) => other.id === keyId);

    if (!key) {
      throw new Error(`three-cameras: "${id}" has no key "${keyId}"`);
    }

    const local = world.clone();

    if (item.camera.parent) {
      item.camera.parent.updateWorldMatrix(true, false);
      item.camera.parent.worldToLocal(local);
    }

    this.updateKey(id, keyId, { pose: { ...key.pose, position: [local.x, local.y, local.z] } });
  }

  private autoTrail(item: Item, time: number) {
    return (
      this.projects(item) &&
      this.inScene(item.camera) &&
      ((this.tracks[item.id]?.length ?? 0) > 0 || time - item.lastMoved < MOVING_MS)
    );
  }

  /** Make the path match its mode: create, draw or drop it. */
  private syncTrail(item: Item, time = now()) {
    const wanted =
      item.trailMode === "on" || (item.trailMode === "auto" && this.autoTrail(item, time));

    if (wanted && !item.trail) {
      const trail = new Group();
      const line = new Line(
        new BufferGeometry(),
        new LineBasicMaterial({ color: "#fbbf24", transparent: true, opacity: 0.9 }),
      );
      const markers = new Points(
        new BufferGeometry(),
        new PointsMaterial({ color: "#ffffff", size: 8, sizeAttenuation: false }),
      );
      const recorded = new Line(
        new BufferGeometry(),
        new LineBasicMaterial({ color: "#7dd3fc", transparent: true, opacity: 0.55 }),
      );

      trail.name = `${item.id} (three-cameras path)`;
      trail.userData.threeCameras = true;
      trail.add(line, markers, recorded);
      // Poses are the camera's own, relative to its parent: the path lives there too.
      (item.camera.parent ?? this.options.scene).add(trail);
      item.trail = trail;
      this.drawTrail(item);
      this.notifySoon();
    } else if (!wanted && item.trail) {
      this.dropTrail(item);
      this.notifySoon();
    } else if (item.trail) {
      this.drawTrail(item);
    }
  }

  private drawTrail(item: Item) {
    const trail = item.trail;

    if (!trail) {
      return;
    }

    const [line, markers, recorded] = trail.children as [Line, Points, Line];
    const keys = this.tracks[item.id] ?? [];

    // Where it's been, for a camera without keys (with keys, the track is the path).
    recorded.geometry.setAttribute(
      "position",
      new Float32BufferAttribute(
        keys.length > 0 ? [] : item.motion.flatMap((sample) => sample.position),
        3,
      ),
    );
    recorded.geometry.computeBoundingSphere();
    const first = keys[0];
    const last = keys.at(-1);
    const path: number[] = [];

    if (first && last) {
      const span = last.time - first.time;
      const count = Math.min(TRAIL_MAX, Math.max(1, Math.ceil(span * TRAIL_RATE)));

      for (let i = 0; i <= count; i += 1) {
        const pose = sampleTrack(keys, first.time + (span * i) / count);

        if (pose) {
          path.push(...pose.position);
        }
      }
    }

    line.geometry.setAttribute("position", new Float32BufferAttribute(path, 3));
    line.geometry.computeBoundingSphere();
    markers.geometry.setAttribute(
      "position",
      new Float32BufferAttribute(
        keys.flatMap((key) => key.pose.position),
        3,
      ),
    );
    markers.geometry.computeBoundingSphere();
    this.options.invalidate?.();
  }

  private dropTrail(item: Item) {
    if (!item.trail) {
      return;
    }

    for (const child of item.trail.children as (Line | Points)[]) {
      child.geometry.dispose();
      (child.material as LineBasicMaterial).dispose();
    }

    item.trail.removeFromParent();
    item.trail = null;
  }

  private saveTracks() {
    this.trackStore.save({ duration: this.state.duration, tracks: this.tracks });
  }

  private engage() {
    this.state.engaged = true;

    for (const item of this.records.values()) {
      item.held = true;
      this.tweens.delete(item);
    }

    this.applyTracks();
    this.options.invalidate?.();
    this.notify();
  }

  /** Every held camera with a track, to where its track is at the playhead. */
  private applyTracks() {
    if (!this.state.engaged) {
      return;
    }

    for (const item of this.records.values()) {
      const keys = this.tracks[item.id];

      if (item.held && keys && keys.length > 0) {
        const pose = sampleTrack(keys, this.state.time);

        if (pose) {
          applyPose(item.camera as Camera, pose);
        }
      }
    }
  }

  /** Move the playhead by the time since the last frame. */
  private advance(time: number) {
    if (!this.state.playing) {
      return;
    }

    // Seconds, capped so a stall (a tab coming back) doesn't jump the playhead; a slow frame
    // rate still plays in real time down to 4 fps.
    const step = this.lastTick === null ? 0 : Math.min(0.25, (time - this.lastTick) / 1000);

    this.lastTick = time;
    this.state.time += step;

    if (this.state.time >= this.state.duration) {
      if (this.state.loop && this.state.duration > 0) {
        this.state.time %= this.state.duration;
      } else {
        this.state.time = this.state.duration;
        this.state.playing = false;
        this.notifySoon();
      }
    }

    // Keep frames coming while playing, for render-on-demand loops.
    this.options.invalidate?.();
  }

  /**
   * Look at the scene again: new cameras get entries, ones that left go (a camera outside the
   * scene stays while it's still rendering, and a few seconds after).
   */
  refresh() {
    if (this.disposed) {
      return;
    }

    const time = now();
    const listed = new Set<SceneCamera>();
    let changed = false;

    for (const camera of findCameras(this.options.scene)) {
      listed.add(camera);
    }

    for (const info of this.options.cameras ?? []) {
      listed.add(info.camera);
    }

    for (const [camera, item] of this.records) {
      const last = item.frames.at(-1);

      if ((last !== undefined && time - last < KEEP_MS) || camera === this.standIn) {
        listed.add(camera);
      }
    }

    for (const camera of listed) {
      if (!this.records.has(camera)) {
        this.add(camera);
        changed = true;
      }
    }

    for (const [camera, item] of this.records) {
      if (!listed.has(camera)) {
        this.remove(item);
        changed = true;
      }
    }

    if (this.looking && !this.records.has(this.looking.camera)) {
      this.looking = null;
      this.standIn = null;
    }

    if (changed) {
      this.notify();
    }
  }

  /** Show or hide a camera's frustum. The helper sits in the lab's scene and follows the camera. */
  setHelper(id: string, on: boolean) {
    const item = this.require(id);

    if (on === (item.helper !== null)) {
      return;
    }

    if (on) {
      if (!this.canHelp(item)) {
        throw new Error(`three-cameras: "${id}" has no frustum to draw (${item.kind})`);
      }

      const helper = new CameraHelper(item.camera as Camera);

      helper.name = `${id} (three-cameras helper)`;
      helper.userData.threeCameras = true;
      this.options.scene.add(helper);
      item.helper = helper;
    } else {
      this.dropHelper(item);
    }

    this.options.invalidate?.();
    this.notify();
  }

  dispose() {
    this.disposed = true;

    for (const item of this.records.values()) {
      this.dropHelper(item);
      this.dropTrail(item);
    }

    this.looking = null;
    this.standIn = null;
    this.state.playing = false;
    this.tweens.clear();
    this.restoreRender?.();
    this.restoreRender = null;
    this.listeners.clear();
  }

  private watch(renderer: unknown) {
    const target = renderer as Partial<RendererLike> | null | undefined;

    if (!target || typeof target.render !== "function") {
      return;
    }

    const render = target.render;
    const own = Object.hasOwn(target, "render");
    const before = (camera: Camera, host: unknown) => this.beforeFrame(camera, host);
    const after = () => this.afterFrame();
    const watched = function (this: unknown, scene: Object3D, camera: Camera, ...rest: never[]) {
      const shown = before(camera, this);

      try {
        return render.call(this, scene, shown, ...rest);
      } finally {
        after();
      }
    };

    target.render = watched;
    this.restoreRender = () => {
      // Someone wrapped it after us: leave theirs in place; ours passes through once disposed.
      if (target.render !== watched) {
        return;
      }

      if (own) {
        target.render = render;
      } else {
        delete target.render;
      }
    };
  }

  /** Before a frame: count it, step moves, and pick the camera it's drawn with. */
  private beforeFrame(camera: Camera, host: unknown): Camera {
    if (this.disposed || !camera) {
      return camera;
    }

    const time = now();

    this.count(camera, time);
    this.measure(camera, host as Viewported | null);
    this.record(time);
    this.advance(time);
    this.applyTracks();
    this.step(time);

    let shown = camera;

    if (this.looking && camera === this.standIn) {
      shown = this.looking.camera as Camera;
      this.count(shown, time);

      // Fit it to the view it's drawn into for this frame; afterFrame puts its aspect back.
      const lens = shown as PerspectiveCamera;
      const view = camera as PerspectiveCamera;

      if (lens.isPerspectiveCamera && view.isPerspectiveCamera && lens.aspect !== view.aspect) {
        this.fitted = { camera: lens, aspect: lens.aspect };
        lens.aspect = view.aspect;
        lens.updateProjectionMatrix();
      }
    }

    // Frustums follow their cameras; the one being looked through hides its own.
    for (const other of this.records.values()) {
      if (other.helper) {
        other.helper.visible = other.camera !== shown;
        other.helper.update();
      }
    }

    this.captureView(camera, shown);

    return shown;
  }

  /** The main view's matrices, when this frame is it: the camera drawing the most of the screen. */
  private captureView(requested: Camera, shown: Camera) {
    const item = this.records.get(requested);

    if (!item) {
      return;
    }

    let main = true;

    for (const other of this.records.values()) {
      if (other.area > item.area) {
        main = false;
        break;
      }
    }

    if (!main || item.area === 0) {
      return;
    }

    shown.updateWorldMatrix(true, false);
    this.view ??= { world: new Matrix4(), projection: new Matrix4(), viewport: new Vector4() };
    this.view.world.copy(shown.matrixWorld);
    this.view.projection.copy(shown.projectionMatrix);
    this.view.viewport.copy(this.viewport);
  }

  /**
   * Note where cameras in the scene are, when they've moved: their recent motion, drawn for a
   * camera without keys and bakeable into keys. A camera its track is driving isn't recorded.
   */
  private record(time: number) {
    const driving = this.state.engaged;

    for (const item of this.records.values()) {
      if (!this.projects(item) || !this.inScene(item.camera)) {
        continue;
      }

      const tracked = (this.tracks[item.id]?.length ?? 0) > 0;

      if (!(driving && item.held && tracked)) {
        const { position, quaternion } = item.camera;
        const last = item.motion.at(-1);
        const moved =
          !last ||
          Math.abs(last.position[0] - position.x) > STILL ||
          Math.abs(last.position[1] - position.y) > STILL ||
          Math.abs(last.position[2] - position.z) > STILL ||
          Math.abs(last.quaternion[3] - quaternion.w) > STILL;

        if (moved) {
          if (last) {
            item.lastMoved = time;
          }

          item.motion.push({
            time,
            position: [position.x, position.y, position.z],
            quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
          });
        }

        while (
          item.motion.length > RECORD_MAX ||
          (item.motion.length > 0 && time - item.motion[0]!.time > RECORD_MS)
        ) {
          item.motion.shift();
        }
      }

      if (item.trailMode === "auto" || item.trail) {
        const was = item.trail !== null;

        if (item.trail && !tracked && time - item.motionDrawn >= MOTION_REDRAW_MS) {
          item.motionDrawn = time;
          this.drawTrail(item);
        }

        if (item.trailMode === "auto" && was !== this.autoTrail(item, time)) {
          this.syncTrail(item, time);
        }
      }
    }
  }

  private afterFrame() {
    if (this.fitted) {
      this.fitted.camera.aspect = this.fitted.aspect;
      this.fitted.camera.updateProjectionMatrix();
      this.fitted = null;
    }
  }

  /** How much of the screen this frame covers, if the renderer says. */
  private measure(camera: Camera, host: Viewported | null) {
    const item = this.records.get(camera);

    if (!item || typeof host?.getCurrentViewport !== "function") {
      return;
    }

    const offscreen = typeof host.getRenderTarget === "function" && host.getRenderTarget() !== null;
    const viewport = host.getCurrentViewport(this.viewport);

    item.area = offscreen ? 0 : viewport.z * viewport.w;
  }

  private count(camera: Camera, time: number) {
    const item = this.records.get(camera);

    if (item) {
      item.frames.push(time);

      while (item.frames.length > 0 && time - item.frames[0]! > 1000) {
        item.frames.shift();
      }
    } else if (this.findOwner(camera) === null) {
      // A new camera: listed now, with this frame counted. Listeners hear after the frame.
      this.add(camera).frames.push(time);
      this.notifySoon();
    }
  }

  /** Moves to saved views, one step per frame. */
  private step(time: number) {
    if (this.tweens.size === 0) {
      return;
    }

    for (const [item, tween] of this.tweens) {
      const t = Math.min(1, (time - tween.start) / tween.duration);

      applyPose(item.camera as Camera, blendPoses(tween.from, tween.to, easeInOut(t)));

      if (t >= 1) {
        this.tweens.delete(item);
      }
    }

    // Keep frames coming until the move lands, for render-on-demand loops.
    this.options.invalidate?.();
  }

  /** A camera the renderer was handed that belongs to one listed, like a CubeCamera's faces. */
  private findOwner(camera: Camera) {
    for (let node: Object3D | null = camera.parent; node; node = node.parent) {
      if (this.records.has(node)) {
        return node;
      }
    }

    return null;
  }

  private canHelp(item: Item) {
    return this.projects(item);
  }

  private projects(item: Item) {
    return item.kind === "perspective" || item.kind === "orthographic";
  }

  private add(camera: SceneCamera): Item {
    const kind = kindOf(camera);
    const registered = this.options.cameras?.find((info) => info.camera === camera)?.name;
    const id = this.uniqueName(registered || camera.name || `${KIND_LABELS[kind]} camera`);
    const item: Item = {
      id,
      camera,
      kind,
      helper: null,
      frames: [],
      area: 0,
      held: true,
      trail: null,
      trailMode: "auto",
      motion: [],
      lastMoved: Number.NEGATIVE_INFINITY,
      motionDrawn: 0,
    };

    this.records.set(camera, item);
    this.byId.set(id, item);

    return item;
  }

  private remove(item: Item) {
    this.dropHelper(item);
    this.dropTrail(item);
    this.tweens.delete(item);

    if (this.selectedId === item.id) {
      this.selectedId = null;
    }

    this.records.delete(item.camera);
    this.byId.delete(item.id);
  }

  private dropHelper(item: Item) {
    if (item.helper) {
      item.helper.removeFromParent();
      item.helper.dispose();
      item.helper = null;
    }
  }

  private uniqueName(base: string) {
    let name = base;

    for (let n = 2; this.byId.has(name); n += 1) {
      name = `${base} ${n}`;
    }

    return name;
  }

  private inScene(camera: SceneCamera) {
    let top: Object3D = camera;

    while (top.parent) {
      top = top.parent;
    }

    return top === this.options.scene;
  }

  private entryOf(item: Item, time: number): CameraEntry {
    const recent = item.frames.filter((at) => time - at <= 1000);
    const last = recent.at(-1);

    return {
      id: item.id,
      kind: item.kind,
      camera: item.camera,
      inScene: this.inScene(item.camera),
      live: last !== undefined && time - last < LIVE_MS,
      fps: recent.length,
      helper: item.helper !== null,
      canHelp: this.canHelp(item),
      path: pathOf(item.camera),
      projects: this.projects(item),
      viewing: this.looking === item,
      standingIn: this.looking !== null && this.standIn === item.camera,
      views: this.saved[item.id]?.length ?? 0,
      keys: this.tracks[item.id]?.length ?? 0,
      trail: item.trail !== null,
      moving: time - item.lastMoved < MOVING_MS,
      recorded: item.motion.length > 1,
      selected: this.selectedId === item.id,
    };
  }

  private require(id: string) {
    const item = this.byId.get(id);

    if (!item) {
      throw new Error(`three-cameras: no camera "${id}"`);
    }

    return item;
  }

  private notifySoon() {
    if (!this.notifyQueued) {
      this.notifyQueued = true;
      queueMicrotask(() => {
        this.notifyQueued = false;
        this.notify();
      });
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
