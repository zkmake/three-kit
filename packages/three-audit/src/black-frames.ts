/**
 * Black-frame probe: after each frame, samples a grid of the drawing buffer and counts frames
 * where several samples are pure black. Catches the flash a NaN pixel makes once bloom spreads it,
 * which lasts one frame in twenty and never shows in a screenshot.
 *
 * WebGL only (`readPixels`). Each sample stalls the GPU pipeline, so watch, read, stop.
 */
import type { Camera, Object3D } from "three";

import { patch } from "./patch.ts";

/** The `WebGLRenderer` methods the probe uses. */
export type ProbeRenderer = {
  render(scene: Object3D, camera: Camera): void;
  getContext(): unknown;
  getRenderTarget(): unknown;
};

export type BlackFrameOptions = {
  /** Samples per side: 3 reads a 3 × 3 grid at the quarter lines. */
  grid?: number;
  /** Black samples that make a frame black. */
  threshold?: number;
};

export type BlackFrameWatch = {
  /** Frames sampled since the start or the last `reset()`. */
  readonly frames: number;
  /** Which of those frames (1-based) were black. */
  readonly blackFrames: readonly number[];
  reset: () => void;
  /** Restore the renderer and stop sampling. */
  stop: () => void;
};

type ReadPixels = Pick<
  WebGLRenderingContext,
  "RGBA" | "UNSIGNED_BYTE" | "drawingBufferHeight" | "drawingBufferWidth" | "readPixels"
>;

/**
 * Sample every frame the app draws to the screen. Several screen renders in one frame (an overlay
 * redrawn after the composer) count once, as the last of them: the image the display shows.
 * Browser only: frames are told apart by `requestAnimationFrame`.
 */
export const watchBlackFrames = (
  renderer: ProbeRenderer,
  options: BlackFrameOptions = {},
): BlackFrameWatch => {
  const context = renderer.getContext() as Partial<ReadPixels> | null;

  if (typeof context?.readPixels !== "function") {
    throw new TypeError("three-audit: the black-frame probe needs a WebGLRenderer");
  }

  if (typeof requestAnimationFrame !== "function") {
    throw new TypeError("three-audit: the black-frame probe needs requestAnimationFrame");
  }

  const gl = context as ReadPixels;
  const grid = options.grid ?? 3;
  const threshold = options.threshold ?? 3;
  const pixel = new Uint8Array(4);
  const render = renderer.render;
  let frames = 0;
  let black: number[] = [];
  let pending: boolean | null = null;

  const isBlack = () => {
    let count = 0;

    for (let i = 1; i <= grid; i += 1) {
      for (let j = 1; j <= grid; j += 1) {
        const x = Math.floor((gl.drawingBufferWidth * i) / (grid + 1));
        const y = Math.floor((gl.drawingBufferHeight * j) / (grid + 1));

        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

        if (pixel[0]! < 4 && pixel[1]! < 4 && pixel[2]! < 4 && pixel[3]! > 250) {
          count += 1;
        }
      }
    }

    return count >= threshold;
  };

  // Commit the frame's last screen sample once per animation frame.
  let raf = 0;
  const commit = () => {
    if (pending !== null) {
      frames += 1;

      if (pending) {
        black.push(frames);
      }

      pending = null;
    }

    raf = requestAnimationFrame(commit);
  };

  raf = requestAnimationFrame(commit);

  const restore = patch(renderer, "render", function (this: unknown, scene, camera) {
    render.call(this, scene, camera);

    // Read before the browser presents (and, without preserveDrawingBuffer, clears) the buffer.
    if (renderer.getRenderTarget() === null) {
      pending = isBlack();
    }
  });

  return {
    get frames() {
      return frames;
    },
    get blackFrames() {
      return black;
    },
    reset: () => {
      frames = 0;
      black = [];
      pending = null;
    },
    stop: () => {
      cancelAnimationFrame(raf);
      restore();
    },
  };
};
