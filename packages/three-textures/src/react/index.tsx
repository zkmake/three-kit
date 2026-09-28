/**
 * `@zkmake/three-textures/react`: `<TexturePanel />` inside a React Three Fiber `<Canvas>`. It
 * reads the scene and renderer from the canvas and asks for a frame after each swap, so it works
 * with `frameloop="demand"` too.
 */
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

import type { TextureLab } from "../core/lab.ts";
import {
  mountTexturePanel,
  type MountTexturePanelOptions,
  type TexturePanelHandle,
} from "../ui/mount.ts";

export type TexturePanelProps = Omit<
  MountTexturePanelOptions,
  "scene" | "renderer" | "invalidate"
> & {
  /** The lab, once mounted: for scripting swaps or listing textures. */
  onReady?: (lab: TextureLab) => void;
};

/**
 * Mounts the docked texture panel for this canvas's scene. `theme` follows its prop; the other
 * props are read on mount (remount with a new `key` to change them).
 */
export function TexturePanel(props: TexturePanelProps) {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const latest = useRef(props);

  useEffect(() => {
    latest.current = props;
  });

  const handle = useRef<TexturePanelHandle | null>(null);

  useEffect(() => {
    const { onReady, onSwap, ...options } = latest.current;
    const mounted = mountTexturePanel({
      ...options,
      scene,
      renderer: gl,
      invalidate: () => invalidate(),
      onSwap: (event) => latest.current.onSwap?.(event),
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
