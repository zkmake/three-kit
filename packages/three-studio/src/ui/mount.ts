import { type AuditHelpersOptions, installAuditHelpers } from "@zkmake/three-audit";
import type { Camera, Object3D } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { installFrameShim, type SaveShotOptions, saveShot } from "../core/capture.ts";
import { formatStats, frameStats, setWireframe, type StatsRenderer } from "../core/frame.ts";
import type { StudioState } from "../core/state.ts";
import { applyView } from "../core/views.ts";
import { mountStudioOverlay, type StudioOverlay, type StudioOverlayOptions } from "./overlay.ts";

/** What the studio needs of a renderer: `WebGLRenderer` and `WebGPURenderer` both fit. */
export type StudioRenderer = StatsRenderer & {
  domElement: HTMLCanvasElement;
  render: (scene: Object3D, camera: Camera) => unknown;
};

export type MountStudioOptions = {
  state: StudioState;
  renderer: StudioRenderer;
  scene: Object3D;
  camera: Camera;
  /**
   * Draws one frame, for `saveShot`. Default `renderer.render(scene, camera)`; pass the
   * composer's render when the page has post-processing.
   */
  render?: (() => void) | undefined;
  /** OrbitControls on the canvas, starting at the view. Default true. */
  controls?: boolean | undefined;
  /**
   * three-audit's console helpers (`summary()`, `zfight()`, `census()`…) on the scene, with the
   * variant's group as the `studioObject`. Default true; options pass through.
   */
  audit?: boolean | Omit<AuditHelpersOptions, "renderer"> | undefined;
  /** The switchers and readout. Default true; options pass through. */
  overlay?: boolean | Omit<StudioOverlayOptions, "state" | "onView"> | undefined;
  /** `window.studio` and `window.saveShot`, for agents and the console. Default true. */
  globals?: boolean | undefined;
  /** Where `saveShot` posts. Default `http://127.0.0.1:8787` (`three-studio serve`). */
  shotEndpoint?: string | undefined;
};

export type StudioHandle = {
  state: StudioState;
  camera: Camera;
  controls: OrbitControls | null;
  overlay: StudioOverlay | null;
  /** Moves the camera to a named view in place and puts it in the URL, so a reload keeps it. */
  setView: (name: string) => void;
  /** Draws a frame and saves it as a PNG at `path` (see `three-studio serve`). */
  saveShot: (path: string, options?: SaveShotOptions) => Promise<string>;
  /** The last frame's readout: `"12 calls · 34,567 tris"`. */
  stats: () => string;
  /** Call after each render: refreshes the readout and keeps `?wire=1` on new meshes. */
  update: () => void;
  dispose: () => void;
};

/** The object `window.studio` holds while a studio is mounted. */
export type StudioGlobal = Pick<
  StudioHandle,
  "state" | "camera" | "setView" | "saveShot" | "stats"
> & {
  scene: Object3D;
  renderer: StudioRenderer;
  /** The view names `setView` takes. */
  views: string[];
  /** For a hidden browser pane: see `installFrameShim`. */
  installFrameShim: () => boolean;
};

declare global {
  interface Window {
    studio?: StudioGlobal;
    saveShot?: StudioHandle["saveShot"];
  }
}

/**
 * Wires a page around one renderer: camera at the URL's view, orbit controls, three-audit's console
 * helpers, the overlay, `window.studio`, and `?wire=1`. The page builds the scene itself and tags
 * what's under study with `userData.studioObject = state.tag`.
 *
 *   const state = resolveStudio(config, location.search);
 *   const studio = mountStudio({ state, renderer, scene, camera });
 *   renderer.setAnimationLoop(() => { renderer.render(scene, camera); studio.update(); });
 */
export function mountStudio(options: MountStudioOptions): StudioHandle {
  const { state, renderer, scene, camera } = options;
  const render = options.render ?? (() => renderer.render(scene, camera));
  const controls =
    options.controls === false ? null : new OrbitControls(camera, renderer.domElement);
  // The page's window; none when rendered under Node (tests, SSR), where only the camera moves.
  const page = typeof window === "undefined" ? null : window;

  applyView(camera, state.view, controls);

  const stats = () => formatStats(frameStats(renderer));

  const setView = (name: string) => {
    const view = state.views[name];

    if (!view) {
      throw new Error(
        `three-studio: no view "${name}"; this page has ${Object.keys(state.views).join(", ")}`,
      );
    }

    applyView(camera, view, controls);
    overlay?.setView(name);

    if (page) {
      const url = new URL(page.location.href);

      url.searchParams.set("view", name);
      page.history.replaceState(page.history.state, "", url);
    }
  };

  const shot = (path: string, shotOptions: SaveShotOptions = {}) =>
    saveShot(path, {
      canvas: renderer.domElement,
      render,
      stats,
      endpoint: options.shotEndpoint,
      ...shotOptions,
    });

  const overlayOptions = typeof options.overlay === "object" ? options.overlay : {};
  const overlay =
    options.overlay === false
      ? null
      : mountStudioOverlay({ ...overlayOptions, state, onView: setView });

  const auditOptions = typeof options.audit === "object" ? options.audit : {};
  const uninstallAudit =
    options.audit === false
      ? null
      : installAuditHelpers(scene, {
          ...auditOptions,
          renderer: renderer as unknown as AuditHelpersOptions["renderer"],
        });

  const global: StudioGlobal = {
    state,
    scene,
    camera,
    renderer,
    views: Object.keys(state.views),
    setView,
    saveShot: shot,
    stats,
    installFrameShim,
  };

  if (page && options.globals !== false) {
    page.studio = global;
    page.saveShot = shot;
  }

  return {
    state,
    camera,
    controls,
    overlay,
    setView,
    saveShot: shot,
    stats,
    update: () => {
      overlay?.setStats(stats());

      if (state.wire) {
        setWireframe(scene, true);
      }
    },
    dispose: () => {
      controls?.dispose();
      overlay?.dispose();
      uninstallAudit?.();

      if (page?.studio === global) {
        delete page.studio;
        delete page.saveShot;
      }
    },
  };
}
