/**
 * Editing motion paths in the scene: the key dots on a camera's path are handles. Hover one and
 * the cursor becomes a hand; drag it and the key moves, on a plane facing the view through where it
 * was (Shift: straight up or down), so the path and the camera's move reshape as you go.
 *
 * It listens on the renderer's canvas in the capture phase and takes only presses that land on a
 * dot, so orbit controls and the app's own handlers get every other press.
 */
import { Matrix4, Plane, Ray, Vector3 } from "three";

import type { CameraLab } from "../core/lab.ts";

/** A dot within this many CSS pixels of the pointer is under it. */
const HIT_PX = 10;

type Hit = { camera: string; key: string; position: Vector3 };

export const createPathEditor = (
  lab: CameraLab,
  canvas: HTMLCanvasElement,
  { onPick }: { onPick?: (camera: string, key: string) => void } = {},
) => {
  const inverseProjection = new Matrix4();
  const point = new Vector3();
  let restoreCursor: string | null = null;
  let dragging = false;

  /** The main view's rectangle on the canvas, in CSS pixels from its top left. */
  const viewRect = (view: NonNullable<ReturnType<CameraLab["viewTransform"]>>) => {
    const box = canvas.getBoundingClientRect();
    const scale = canvas.width > 0 ? box.width / canvas.width : 1;
    const { x, y, z: width, w: height } = view.viewport;

    return {
      left: box.left + x * scale,
      top: box.top + box.height - (y + height) * scale,
      width: width * scale,
      height: height * scale,
    };
  };

  /** The dot under the pointer, nearest first. */
  const hitAt = (clientX: number, clientY: number): Hit | null => {
    const view = lab.viewTransform();

    if (!view) {
      return null;
    }

    const rect = viewRect(view);
    const toView = view.world.clone().invert();
    let best: Hit | null = null;
    let bestDistance = HIT_PX;

    for (const handle of lab.keyHandles()) {
      point.copy(handle.position).applyMatrix4(toView).applyMatrix4(view.projection);

      if (point.z < -1 || point.z > 1) {
        continue;
      }

      const x = rect.left + ((point.x + 1) / 2) * rect.width;
      const y = rect.top + ((1 - point.y) / 2) * rect.height;
      const distance = Math.hypot(x - clientX, y - clientY);

      if (distance < bestDistance) {
        bestDistance = distance;
        best = handle;
      }
    }

    return best;
  };

  /** The ray from the view through a screen point. */
  const rayAt = (clientX: number, clientY: number) => {
    const view = lab.viewTransform();

    if (!view) {
      return null;
    }

    const rect = viewRect(view);
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);

    inverseProjection.copy(view.projection).invert();

    const near = new Vector3(ndcX, ndcY, -1)
      .applyMatrix4(inverseProjection)
      .applyMatrix4(view.world);
    const far = new Vector3(ndcX, ndcY, 1).applyMatrix4(inverseProjection).applyMatrix4(view.world);

    return { ray: new Ray(near, far.sub(near).normalize()), view };
  };

  const setCursor = (cursor: string | null) => {
    if (cursor) {
      restoreCursor ??= canvas.style.cursor;
      canvas.style.cursor = cursor;
    } else if (restoreCursor !== null) {
      canvas.style.cursor = restoreCursor;
      restoreCursor = null;
    }
  };

  const onHover = (event: PointerEvent) => {
    if (!dragging) {
      setCursor(hitAt(event.clientX, event.clientY) ? "grab" : null);
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    const hit = hitAt(event.clientX, event.clientY);
    const start = hit ? rayAt(event.clientX, event.clientY) : null;

    if (!hit || !start) {
      return;
    }

    // Ours: keep it from orbit controls and the app.
    event.stopImmediatePropagation();
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    dragging = true;
    setCursor("grabbing");
    onPick?.(hit.camera, hit.key);
    lab.select(hit.camera);

    const key = lab.keys(hit.camera).find((other) => other.id === hit.key);

    if (key) {
      lab.seek(key.time);
    }

    const origin = hit.position.clone();
    const facing = new Vector3(0, 0, -1).transformDirection(start.view.world);
    const plane = new Plane().setFromNormalAndCoplanarPoint(facing, origin);
    // For Shift: a vertical plane facing the view, to move straight up or down.
    const level = facing.clone().setY(0);
    const upright = new Plane().setFromNormalAndCoplanarPoint(
      level.lengthSq() > 1e-6 ? level.normalize() : new Vector3(0, 0, 1),
      origin,
    );
    const grabbed = start.ray.intersectPlane(plane, new Vector3()) ?? origin.clone();
    const grabbedUpright = start.ray.intersectPlane(upright, new Vector3()) ?? origin.clone();

    const onMove = (move: PointerEvent) => {
      const next = rayAt(move.clientX, move.clientY);

      if (!next) {
        return;
      }

      let target: Vector3 | null;

      if (move.shiftKey) {
        const hitUpright = next.ray.intersectPlane(upright, new Vector3());

        target = hitUpright
          ? origin.clone().setY(origin.y + hitUpright.y - grabbedUpright.y)
          : null;
      } else {
        const hitPlane = next.ray.intersectPlane(plane, new Vector3());

        target = hitPlane ? origin.clone().add(hitPlane.sub(grabbed)) : null;
      }

      if (target) {
        try {
          lab.moveKeyTo(hit.camera, hit.key, target);
        } catch {
          // The key went away mid-drag (deleted in the panel): nothing to move.
        }
      }
    };

    const onUp = () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      dragging = false;
      setCursor(null);
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
  };

  canvas.addEventListener("pointermove", onHover);
  canvas.addEventListener("pointerdown", onPointerDown, { capture: true });

  return {
    /** For tests and hosts: the dot under a screen point, if any. */
    hitAt,
    dispose: () => {
      canvas.removeEventListener("pointermove", onHover);
      canvas.removeEventListener("pointerdown", onPointerDown, { capture: true });
      setCursor(null);
    },
  };
};
