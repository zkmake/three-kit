import { describe, expect, test } from "vitest";

import { resolveStudio, type StudioConfig, studioHref, studioTime } from "./state.ts";

const play = { position: [0, 4, 9] as const, target: [0, 0, 0] as const, fov: 30 };
const close = { position: [0, 1, 3] as const, target: [0, 0.5, 0] as const };
const low = { position: [0, 0.4, 6] as const, target: [0, 0.4, 0] as const, fov: 50 };

const CONFIG: StudioConfig = {
  views: { play },
  areas: {
    trees: {
      title: "Trees",
      views: { close },
      variants: { now: { label: "Now" }, lush: { label: "Lush" } },
    },
    camera: { variants: { chase: {}, low: { views: { low } } } },
  },
};

describe("resolveStudio", () => {
  test("defaults to the first area, its first variant and the play view", () => {
    const state = resolveStudio(CONFIG, "");

    expect(state).toMatchObject({
      areaName: "trees",
      variantName: "now",
      viewName: "play",
      view: play,
      clean: false,
      wire: false,
      time: null,
      shots: null,
      tag: "trees-now",
      unknown: [],
    });
    expect(Object.keys(state.views)).toEqual(["play", "close"]);
  });

  test("reads area, variant, view and the shot switches", () => {
    const state = resolveStudio(CONFIG, "?area=trees&v=lush&view=close&clean=1&wire=1&t=2.5");

    expect(state).toMatchObject({
      variantName: "lush",
      viewName: "close",
      view: close,
      clean: true,
      wire: true,
      time: 2.5,
      tag: "trees-lush",
    });
  });

  test("a variant's own views join the area's", () => {
    const state = resolveStudio(CONFIG, "?area=camera&v=low&view=low");

    expect(state.view).toBe(low);
    expect(Object.keys(state.views)).toEqual(["play", "low"]);
    expect(Object.keys(resolveStudio(CONFIG, "?area=camera").views)).toEqual(["play"]);
  });

  test("a bare ?<area> picks the area, as single-object studios link", () => {
    expect(resolveStudio(CONFIG, "?camera&view=play").areaName).toBe("camera");
  });

  test("falls back on names it doesn't know, and lists them", () => {
    const state = resolveStudio(CONFIG, "?area=rocks&v=big&view=drone&t=soon");

    expect(state).toMatchObject({ areaName: "trees", variantName: "now", viewName: "play" });
    expect(state.time).toBeNull();
    expect(state.unknown).toEqual(["area=rocks", "v=big", "view=drone", "t=soon"]);
  });

  test("without a play view, the first one is the default", () => {
    const state = resolveStudio({ areas: { a: { views: { close }, variants: { x: {} } } } }, "");

    expect(state.viewName).toBe("close");
  });

  test("reads the receiver's port from shots=, and lists a bad one", () => {
    expect(resolveStudio(CONFIG, "?shots=8797").shots).toBe(8797);
    expect(resolveStudio(CONFIG, "?shots=nope")).toMatchObject({
      shots: null,
      unknown: ["shots=nope"],
    });
  });

  test("throws on a config it can't show", () => {
    expect(() => resolveStudio({ areas: {} }, "")).toThrow(/no areas/);
    expect(() => resolveStudio({ areas: { a: { variants: {} } } }, "")).toThrow(/no variants/);
  });
});

describe("studioHref", () => {
  const state = resolveStudio(CONFIG, "?area=trees&v=lush&view=close&wire=1&t=1&clean=1");

  test("keeps the view and switches, drops clean", () => {
    expect(studioHref(state, { view: "play" })).toBe("?area=trees&v=lush&view=play&wire=1&t=1");
  });

  test("a new area starts at its first variant", () => {
    expect(studioHref(state, { area: "camera" })).toBe("?area=camera&view=close&wire=1&t=1");
  });

  test("switches can be turned off or on", () => {
    expect(studioHref(state, { wire: false, time: null, clean: true })).toBe(
      "?area=trees&v=lush&view=close&clean=1",
    );
  });

  test("carries the receiver's port", () => {
    const shooting = resolveStudio(CONFIG, "?area=trees&shots=8797");

    expect(studioHref(shooting, { area: "camera" })).toBe("?area=camera&view=play&shots=8797");
  });

  test("round-trips through resolveStudio", () => {
    const next = resolveStudio(CONFIG, studioHref(state, { variant: "now" }));

    expect(next).toMatchObject({ variantName: "now", viewName: "close", wire: true, time: 1 });
  });
});

test("studioTime freezes at ?t= and runs otherwise", () => {
  expect(studioTime({ time: 2 }, 9)).toBe(2);
  expect(studioTime({ time: null }, 9)).toBe(9);
});
