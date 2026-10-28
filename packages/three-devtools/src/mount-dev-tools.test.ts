import type { PerfRenderer } from "@zkmake/three-meter";
import { Mesh, Scene } from "three";
import { afterEach, describe, expect, test, vi } from "vitest";

import { hasDebugFlag, mountDevTools, type PanelMountOptions } from "./mount-dev-tools.ts";

// The HUD needs a DOM; here the meter is a pair of spies, and the test checks what reaches it.
const meter = vi.hoisted(() => ({
  begin: vi.fn(),
  end: vi.fn(),
  hudOptions: [] as unknown[],
  setBudgets: vi.fn(),
  disposed: vi.fn(),
}));

vi.mock("./hud.ts", () => ({
  mountHud: (_renderer: unknown, options: unknown) => {
    meter.hudOptions.push(options);

    return {
      dispose: meter.disposed,
      hud: { setBudgets: meter.setBudgets, setQuality: vi.fn() },
      monitor: { begin: meter.begin, end: meter.end },
    };
  },
}));

const renderer = {} as PerfRenderer;
const scene = new Scene().add(new Mesh());
const helpers = globalThis as { tris?: unknown };

const panel = () => {
  const mounted: PanelMountOptions[] = [];
  const dispose = vi.fn();

  return {
    dispose,
    load: vi.fn(async () => ({
      mountCameraPanel: (options: PanelMountOptions) => {
        mounted.push(options);
        return { dispose };
      },
    })),
    mounted,
  };
};

afterEach(() => {
  vi.clearAllMocks();
  meter.hudOptions.length = 0;
});

describe("mountDevTools", () => {
  test("off without the flag: loads nothing, wrap passes through", async () => {
    const cameras = panel();
    const tools = mountDevTools({ panels: { cameras: cameras.load }, renderer, scene });
    const loop = vi.fn();

    await tools.ready;

    expect(hasDebugFlag()).toBe(false);
    expect(tools.enabled).toBe(false);
    expect(tools.monitor).toBeNull();
    expect(cameras.load).not.toHaveBeenCalled();
    expect(meter.hudOptions).toHaveLength(0);
    expect(helpers.tris).toBeUndefined();

    tools.wrap(loop)(16);
    tools.frame();

    expect(loop).toHaveBeenCalledWith(16);
    tools.dispose();
  });

  test("dev: the console helpers alone, removed on dispose", async () => {
    const cameras = panel();
    const tools = mountDevTools({ dev: true, panels: { cameras: cameras.load }, renderer, scene });

    await tools.ready;

    expect(typeof helpers.tris).toBe("function");
    expect(meter.hudOptions).toHaveLength(0);
    expect(cameras.load).not.toHaveBeenCalled();

    tools.dispose();

    expect(helpers.tris).toBeUndefined();
  });

  test("on: HUD with the app's budgets, panels, helpers; frames reach the meter", async () => {
    const cameras = panel();
    const budgets = { frame: { calls: 60, fps: 60, triangles: 150_000 } };
    const quality = { state: null };
    const tools = mountDevTools({
      budgets,
      enabled: true,
      hud: { storageKey: "game:hud" },
      panels: { cameras: cameras.load },
      quality,
      renderer,
      scene,
      theme: "dark",
    });

    await tools.ready;

    expect(meter.hudOptions).toEqual([{ budgets, quality, storageKey: "game:hud", theme: "dark" }]);
    expect(cameras.mounted).toEqual([{ invalidate: undefined, renderer, scene, theme: "dark" }]);
    expect(typeof helpers.tris).toBe("function");

    tools.frame();
    tools.frame();

    expect(meter.begin).toHaveBeenCalledTimes(2);
    expect(meter.end).toHaveBeenCalledTimes(1);

    tools.setBudgets(false);
    expect(meter.setBudgets).toHaveBeenCalledWith(false);

    tools.dispose();

    expect(meter.disposed).toHaveBeenCalledOnce();
    expect(cameras.dispose).toHaveBeenCalledOnce();
    expect(helpers.tris).toBeUndefined();
    expect(tools.monitor).toBeNull();
  });

  test("disposed while loading: nothing mounts", async () => {
    const cameras = panel();
    const tools = mountDevTools({
      enabled: true,
      panels: { cameras: cameras.load },
      renderer,
      scene,
    });

    tools.dispose();
    await tools.ready;

    expect(meter.hudOptions).toHaveLength(0);
    expect(cameras.mounted).toHaveLength(0);
    expect(helpers.tris).toBeUndefined();
  });

  test("a panel that fails to load warns and leaves the rest", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tools = mountDevTools({
      audit: false,
      enabled: true,
      panels: { textures: () => Promise.reject(new Error("offline")) },
      renderer,
      scene,
    });

    await tools.ready;

    expect(warn).toHaveBeenCalledOnce();
    expect(meter.hudOptions).toHaveLength(1);
    expect(helpers.tris).toBeUndefined();

    tools.dispose();
    warn.mockRestore();
  });

  test("wrap brackets each tick", async () => {
    const tools = mountDevTools({ audit: false, enabled: true, renderer, scene });

    await tools.ready;
    tools.wrap(() => {
      expect(meter.begin).toHaveBeenCalledOnce();
      expect(meter.end).not.toHaveBeenCalled();
    })();

    expect(meter.end).toHaveBeenCalledOnce();
    tools.dispose();
  });
});
