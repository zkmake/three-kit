import { useFrame, useThree } from "@react-three/fiber";
import type { AnyObject3D } from "@zkmake/three-audit";
import type { PerfRenderer } from "@zkmake/three-meter";
import { useEffect, useRef } from "react";

import {
  type DevToolsHandle,
  mountDevTools,
  type MountDevToolsOptions,
} from "../mount-dev-tools.ts";

type DevToolsProps = Omit<MountDevToolsOptions, "renderer" | "scene" | "invalidate">;

/**
 * The app's dev tools for this `<Canvas>`: put it inside, once. It reads the scene and renderer from
 * the canvas and marks a frame from `useFrame` for the meter. The HUD and panels are DOM mounted
 * imperatively, so it renders nothing into the scene.
 *
 * `budgets` (by value) and `quality` apply live. `flag`, `enabled`, `dev`, `hud` (by value) and which
 * `panels` are set remount the tools; `theme`, `audit` and the panel loaders are read on mount.
 */
function DevTools(props: DevToolsProps) {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const latest = useRef(props);
  const handle = useRef<DevToolsHandle | null>(null);
  const { budgets, dev, enabled, flag, quality } = props;
  const budgetsKey = JSON.stringify(budgets ?? null);
  const hudKey = JSON.stringify(props.hud ?? null);
  const panelsKey = Object.keys(props.panels ?? {})
    .sort()
    .join();

  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const mounted = mountDevTools({
      ...latest.current,
      invalidate: () => invalidate(),
      renderer: gl as unknown as PerfRenderer,
      scene: scene as unknown as AnyObject3D,
    });

    handle.current = mounted;

    return () => {
      handle.current = null;
      mounted.dispose();
    };
    // hudKey and panelsKey stand for the props read through `latest`.
  }, [dev, enabled, flag, gl, hudKey, invalidate, panelsKey, scene]);

  useEffect(() => {
    handle.current?.setBudgets(latest.current.budgets);
  }, [budgetsKey]);

  useEffect(() => {
    handle.current?.setQuality(quality);
  }, [quality]);

  useFrame(() => {
    handle.current?.frame();
  });

  return null;
}

export { DevTools };
export type { DevToolsProps };
