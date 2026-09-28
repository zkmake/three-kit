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
 * place of the app's main one (fitted to its aspect for that frame), and a move to a saved view
 * steps once per frame, before the frame draws.
 */
import {
  type Camera,
  CameraHelper,
  Euler,
  type Object3D,
  type OrthographicCamera,
  type PerspectiveCamera,
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
};

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
  private notifyQueued = false;
  private disposed = false;

  constructor(options: CameraLabOptions) {
    this.options = options;
    this.store = options.store ?? memoryViews();
    this.saved = { ...this.store.load() };
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
    this.options.invalidate?.();
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

    if (duration <= 0 || !this.watching) {
      this.tweens.delete(item);
      applyPose(camera, view.pose);
    } else {
      this.tweens.set(item, { from: capturePose(camera), to: view.pose, start: now(), duration });
    }

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
    }

    this.looking = null;
    this.standIn = null;
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

    return shown;
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
    const item: Item = { id, camera, kind, helper: null, frames: [], area: 0 };

    this.records.set(camera, item);
    this.byId.set(id, item);

    return item;
  }

  private remove(item: Item) {
    this.dropHelper(item);
    this.tweens.delete(item);
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
