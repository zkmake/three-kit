/**
 * `@zkmake/three-cameras/react`: `<CameraPanel />` inside a React Three Fiber `<Canvas>`. It reads
 * the scene and renderer from the canvas, so the canvas's own camera shows as live, and asks for a
 * frame after a helper toggles, so it works with `frameloop="demand"` too.
 */
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

import type { CameraLab } from "../core/lab.ts";
import {
  type CameraPanelHandle,
  mountCameraPanel,
  type MountCameraPanelOptions,
} from "../ui/mount.ts";

export type CameraPanelProps = Omit<
  MountCameraPanelOptions,
  "scene" | "renderer" | "invalidate"
> & {
  /** The lab, once mounted: for listing cameras or toggling helpers from code. */
  onReady?: (lab: CameraLab) => void;
};

/**
 * Mounts the docked camera panel for this canvas's scene. `theme` follows its prop; the other
 * props are read on mount (remount with a new `key` to change them).
 */
export function CameraPanel(props: CameraPanelProps) {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const latest = useRef(props);

  useEffect(() => {
    latest.current = props;
  });

  const handle = useRef<CameraPanelHandle | null>(null);

  useEffect(() => {
    const { onReady, ...options } = latest.current;
    const mounted = mountCameraPanel({
      ...options,
      scene,
      renderer: gl,
      invalidate: () => invalidate(),
    });

    handle.current = mounted;
    onReady?.(mounted.lab);

    return () => {
      handle.current = null;
      mounted.dispose();
    };
  }, [scene, gl, invalidate]);

  // The theme follows the prop; the rest is read on mount.
  useEffect(() => {
    handle.current?.setTheme(props.theme ?? "system");
  }, [props.theme]);

  return null;
}
