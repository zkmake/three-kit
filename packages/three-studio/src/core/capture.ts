/**
 * Screenshots of the canvas, saved to disk by the `three-studio serve` receiver. Built for agents
 * driving a browser: `saveShot(path)` draws a fresh frame right before reading it, so it works
 * without `preserveDrawingBuffer` and in a hidden pane where `requestAnimationFrame` never fires.
 */

export const SHOT_PORT = 8787;

export type ShotSize = "pixels" | "css";

export type SaveShotOptions = {
  /** Default: the first canvas on the page. */
  canvas?: HTMLCanvasElement | undefined;
  /** Draws one frame. Called right before the read, so the image is that frame. */
  render?: (() => void) | undefined;
  /** `pixels` (default) keeps the drawing buffer's size; `css` scales to the canvas's CSS size. */
  size?: ShotSize | undefined;
  /** The receiver (`three-studio serve`). Default `http://127.0.0.1:8787`. */
  endpoint?: string | undefined;
  /** Appended to the result, after the path: the draw-call readout. */
  stats?: (() => string) | undefined;
};

/**
 * Hidden browser panes get no `requestAnimationFrame`, so a scene sits on its first frame. This
 * swaps in a `MessageChannel` ticker at ~60 Hz while the page is hidden, then fires `resize` so a
 * render loop whose last request was stranded asks again. Install it after the scene has mounted.
 * Frame rates from a shimmed page mean nothing; draws and triangles still hold. Returns whether it
 * installed (only once, and only on a hidden page).
 */
export function installFrameShim(): boolean {
  const host = window as Window & { __studioFrameShim?: boolean };

  if (host.__studioFrameShim || !document.hidden) {
    return false;
  }

  host.__studioFrameShim = true;

  const queue = new Map<number, FrameRequestCallback>();
  const channel = new MessageChannel();
  let id = 0;
  let last = 0;

  channel.port1.onmessage = () => {
    const now = performance.now();

    if (now - last >= 16 && queue.size > 0) {
      last = now;

      const due = [...queue.values()];

      queue.clear();
      due.forEach((callback) => callback(now));
    }

    channel.port2.postMessage(0);
  };

  window.requestAnimationFrame = (callback) => {
    id += 1;
    queue.set(id, callback);

    return id;
  };
  window.cancelAnimationFrame = (handle) => {
    queue.delete(handle);
  };

  channel.port2.postMessage(0);
  window.dispatchEvent(new Event("resize"));

  return true;
}

/** The canvas as a PNG. With `render`, draws first in the same task, so the buffer is current. */
export async function canvasPng(
  canvas: HTMLCanvasElement,
  { render, size = "pixels" }: Pick<SaveShotOptions, "render" | "size"> = {},
): Promise<Blob> {
  render?.();

  let source = canvas;

  if (size === "css" && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
    source = document.createElement("canvas");
    source.width = canvas.clientWidth;
    source.height = canvas.clientHeight;
    source.getContext("2d")?.drawImage(canvas, 0, 0, source.width, source.height);
  }

  // toBlob snapshots the bitmap when called, before the browser clears an unpreserved buffer.
  const png = await new Promise<Blob | null>((resolve) => source.toBlob(resolve, "image/png"));

  if (!png || png.size === 0) {
    throw new Error(
      `three-studio: no image from the canvas (${canvas.width} × ${canvas.height}; a 0 × 0 canvas is a hidden or unlaid-out page)`,
    );
  }

  return png;
}

/**
 * Saves the canvas as a PNG at `path` through the receiver, which writes only `.png` files inside
 * the folder it serves. Resolves to `"<path written>  <stats>"`.
 */
export async function saveShot(path: string, options: SaveShotOptions = {}): Promise<string> {
  const canvas = options.canvas ?? document.querySelector("canvas");

  if (!canvas) {
    throw new Error("three-studio: no canvas on the page");
  }

  const png = await canvasPng(canvas, options);
  const endpoint = options.endpoint ?? `http://127.0.0.1:${SHOT_PORT}`;
  let response: Response;

  try {
    response = await fetch(`${endpoint}/shot?path=${encodeURIComponent(path)}`, {
      method: "POST",
      body: png,
    });
  } catch {
    throw new Error(
      `three-studio: no shot receiver at ${endpoint}; run \`npx three-studio serve <folder>\``,
    );
  }

  if (!response.ok) {
    throw new Error(`three-studio: ${response.status} ${await response.text()}`);
  }

  const written = await response.text();
  const stats = options.stats?.();

  return stats ? `${written}  ${stats}` : written;
}
