/**
 * `@zkmake/three-textures/react`: `<TexturePanel />` inside a React Three Fiber `<Canvas>`. It
 * reads the scene and renderer from the canvas and asks for a frame after each swap, so it works
 * with `frameloop="demand"` too.
 */
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

import type { TextureLab } from "../core/lab.ts";
import { mountTexturePanel, type MountTexturePanelOptions } from "../ui/mount.ts";

export type TexturePanelProps = Omit<
  MountTexturePanelOptions,
  "scene" | "renderer" | "invalidate"
> & {
  /** The lab, once mounted: for scripting swaps or listing textures. */
  onReady?: (lab: TextureLab) => void;
};

/**
 * Mounts the docked texture panel for this canvas's scene. Props are read on mount; remount (a
 * new `key`) to change them.
 */
export function TexturePanel(props: TexturePanelProps) {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const latest = useRef(props);

  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const { onReady, onSwap, ...options } = latest.current;
    const handle = mountTexturePanel({
      ...options,
      scene,
      renderer: gl,
      invalidate: () => invalidate(),
      onSwap: (event) => latest.current.onSwap?.(event),
    });

    onReady?.(handle.lab);

    return () => handle.dispose();
  }, [scene, gl, invalidate]);

  return null;
}
