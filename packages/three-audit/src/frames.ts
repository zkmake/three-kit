/**
 * Waiting on animation frames without hanging: a tab in the background (an agent's browser, an
 * occluded window) gets none, so every wait gives up after a timeout and says why.
 */

/** Frames an agent-driven tab should see within this long, in ms. */
export const FRAME_TIMEOUT = 2000;

const noFrame = (caller: string, timeout: number, hint: string) => {
  const hidden = typeof document !== "undefined" && document.hidden;

  return new Error(
    `three-audit: ${caller} got no animation frame in ${timeout / 1000} s${
      hidden
        ? " (document.hidden is true: browsers pause requestAnimationFrame in background tabs)"
        : ""
    }. ${hint}`,
  );
};

/** The next animation frame, or an error naming the cause when none comes within `timeout`. */
export const nextFrame = (caller: string, timeout: number, hint: string) =>
  new Promise<void>((resolve, reject) => {
    if (typeof requestAnimationFrame !== "function") {
      reject(new Error(`three-audit: ${caller} needs requestAnimationFrame`));

      return;
    }

    let frame = 0;
    const timer = setTimeout(() => {
      cancelAnimationFrame(frame);
      reject(noFrame(caller, timeout, hint));
    }, timeout);

    frame = requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
  });
