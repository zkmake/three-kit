import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { type ProbeRenderer, watchBlackFrames } from "./black-frames.ts";

/** A renderer whose drawing buffer is one colour, set per render. */
const fakeRenderer = () => {
  let colour = [255, 255, 255, 255];
  let target: unknown = null;
  const context = {
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
    readPixels: vi.fn(
      (_x: number, _y: number, _w: number, _h: number, _f: number, _t: number, out: Uint8Array) =>
        out.set(colour),
    ),
  };
  const renderer = {
    render: vi.fn(),
    getContext: () => context,
    getRenderTarget: () => target,
    paint: (next: number[]) => {
      colour = next;
    },
    target: (next: unknown) => {
      target = next;
    },
    context,
  };

  return renderer;
};

describe("watchBlackFrames", () => {
  let frame: FrameRequestCallback | undefined;

  const nextFrame = () => {
    const callback = frame;

    frame = undefined;
    callback?.(0);
  };

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frame = callback;

      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      frame = undefined;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("counts frames whose last screen render is black", () => {
    const renderer = fakeRenderer();
    const render = renderer.render;
    const watch = watchBlackFrames(renderer as ProbeRenderer);
    const draw = (colour: number[]) => {
      renderer.paint(colour);
      renderer.render({}, {});
    };

    draw([200, 180, 90, 255]);
    nextFrame();
    // Black mid-frame, then the overlay redraw lands: the frame shows fine.
    draw([0, 0, 0, 255]);
    draw([200, 180, 90, 255]);
    nextFrame();
    draw([0, 0, 0, 255]);
    nextFrame();
    // Nothing rendered this frame: not a frame.
    nextFrame();
    // Off-screen renders aren't sampled.
    renderer.target({});
    draw([0, 0, 0, 255]);
    nextFrame();

    expect(watch.frames).toBe(3);
    expect(watch.blackFrames).toEqual([3]);
    expect(render).toHaveBeenCalledTimes(5);
    expect(renderer.context.readPixels).toHaveBeenCalledTimes(4 * 9);

    watch.reset();
    expect(watch.frames).toBe(0);
    expect(watch.blackFrames).toEqual([]);

    watch.stop();
    expect(renderer.render).toBe(render);
    expect(frame).toBeUndefined();
  });

  test("transparent black is not a black frame", () => {
    const renderer = fakeRenderer();
    const watch = watchBlackFrames(renderer as ProbeRenderer);

    renderer.paint([0, 0, 0, 0]);
    renderer.render({}, {});
    nextFrame();

    expect(watch.blackFrames).toEqual([]);
    watch.stop();
  });

  test("refuses a renderer without readPixels", () => {
    expect(() =>
      watchBlackFrames({ render: () => {}, getContext: () => ({}), getRenderTarget: () => null }),
    ).toThrow(/WebGLRenderer/);
  });
});
