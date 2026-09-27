import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { HudSettings } from "./hud-settings.ts";

const memoryStorage = () => {
  const map = new Map<string, string>();

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
};

describe("HudSettings", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("starts from defaults and persists changes under the key", () => {
    const settings = new HudSettings({ storageKey: "test:hud" });
    expect(settings.isNumberEnabled("fps")).toBe(true);
    expect(settings.isGraphEnabled("gpu")).toBe(false);

    settings.setGraphEnabled("gpu", true);
    settings.setNumberEnabled("fps", false);
    settings.setDim(true);

    const reloaded = new HudSettings({ storageKey: "test:hud" });
    expect(reloaded.isGraphEnabled("gpu")).toBe(true);
    expect(reloaded.isNumberEnabled("fps")).toBe(false);
    expect(reloaded.dim).toBe(true);
  });

  test("info footer is off by default and persists", () => {
    const settings = new HudSettings({ storageKey: "test:info" });
    expect(settings.info).toBe(false);

    settings.setInfo(true);
    expect(new HudSettings({ storageKey: "test:info" }).info).toBe(true);
    expect(new HudSettings({ storageKey: null, defaults: { info: true } }).info).toBe(true);
  });

  test("notifies subscribers and stops after unsubscribe", () => {
    const settings = new HudSettings({ storageKey: null });
    const listener = vi.fn();
    const unsubscribe = settings.subscribe(listener);

    settings.setDim(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    settings.setDim(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("drops unknown graph metrics from storage and survives malformed JSON", () => {
    localStorage.setItem("a", JSON.stringify({ graphs: ["fps", "bogus"] }));
    expect([...new HudSettings({ storageKey: "a" }).selection.graphs]).toEqual(["fps"]);

    localStorage.setItem("b", "{nope");
    expect(new HudSettings({ storageKey: "b" }).isNumberEnabled("calls")).toBe(true);
  });

  test("theme pick is null until set, persists, and drops unknown values", () => {
    const settings = new HudSettings({ storageKey: "test:theme" });
    expect(settings.theme).toBeNull();
    expect(JSON.parse(localStorage.getItem("test:theme") ?? "{}")).not.toHaveProperty("theme");

    settings.setTheme("light");
    expect(new HudSettings({ storageKey: "test:theme" }).theme).toBe("light");

    settings.setTheme(null);
    expect(new HudSettings({ storageKey: "test:theme" }).theme).toBeNull();

    localStorage.setItem("test:bogus", JSON.stringify({ theme: "sepia" }));
    expect(new HudSettings({ storageKey: "test:bogus" }).theme).toBeNull();
  });

  test("null storageKey keeps everything in memory", () => {
    const settings = new HudSettings({ storageKey: null, defaults: { numbers: ["cpu"] } });
    settings.setNumberEnabled("gpu", true);

    expect(settings.isNumberEnabled("cpu")).toBe(true);
    expect(settings.isNumberEnabled("gpu")).toBe(true);
    // Nothing reached storage: a fresh instance with the default key sees only defaults.
    expect(new HudSettings({ storageKey: "test:other" }).isNumberEnabled("gpu")).toBe(true);
    expect(new HudSettings({ storageKey: "test:other" }).isNumberEnabled("triangles")).toBe(false);
  });
});
