/**
 * `CameraLab`: the cameras a scene has and the ones drawing it. No UI; the panel drives it.
 *
 * Cameras come from two places: the scene graph, and the renderer. The camera an app renders with
 * is often not in the scene at all (R3F's default camera isn't; most vanilla apps never add
 * theirs), so the lab wraps `renderer.render` and notes every camera it's handed: that's how it
 * knows which are live, and how often each draws.
 *
 * Entries are named by the `cameras` option, else the camera's name, else its kind, numbered when
 * they repeat. A name holds for as long as the camera is listed.
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
} from "three";

import { type CameraKind, findCameras, kindOf, pathOf, type SceneCamera } from "./discover.ts";

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
  projection: Projection | null;
};

type Item = {
  id: string;
  camera: SceneCamera;
  kind: CameraKind;
  helper: CameraHelper | null;
  /** When each of the last second's frames drew, ms. */
  frames: number[];
};

/** Rendered this recently counts as live, ms. */
const LIVE_MS = 500;
/** A camera outside the scene stays listed this long after its last frame, ms. */
const KEEP_MS = 5000;

const KIND_LABELS: Record<CameraKind, string> = {
  perspective: "perspective",
  orthographic: "orthographic",
  array: "array",
  cube: "cube",
  other: "camera",
};

const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

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
  private restoreRender: (() => void) | null = null;
  private notifyQueued = false;
  private disposed = false;

  constructor(options: CameraLabOptions) {
    this.options = options;
    this.watch(options.renderer);
    this.refresh();
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

    return {
      position: [position.x, position.y, position.z],
      rotation: [toDegrees(euler.x), toDegrees(euler.y), toDegrees(euler.z)],
      projection: projectionOf(camera, item.kind),
    };
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

      if (last !== undefined && time - last < KEEP_MS) {
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
    const onFrame = (camera: Camera) => this.onFrame(camera);
    const watched = function (this: unknown, scene: Object3D, camera: Camera, ...rest: never[]) {
      onFrame(camera);

      return render.call(this, scene, camera, ...rest);
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

  private onFrame(camera: Camera) {
    if (this.disposed || !camera) {
      return;
    }

    const time = now();
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

    // Frustums follow their cameras; the one being looked through hides its own.
    for (const other of this.records.values()) {
      if (other.helper) {
        other.helper.visible = other.camera !== camera;
        other.helper.update();
      }
    }
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
    return item.kind === "perspective" || item.kind === "orthographic";
  }

  private add(camera: SceneCamera): Item {
    const kind = kindOf(camera);
    const registered = this.options.cameras?.find((info) => info.camera === camera)?.name;
    const id = this.uniqueName(registered || camera.name || `${KIND_LABELS[kind]} camera`);
    const item: Item = { id, camera, kind, helper: null, frames: [] };

    this.records.set(camera, item);
    this.byId.set(id, item);

    return item;
  }

  private remove(item: Item) {
    this.dropHelper(item);
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
