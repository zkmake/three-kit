import { describe, expect, test } from "vitest";

import { Hider } from "./hider.ts";

const object = (visible = true) => ({ visible });

describe("Hider", () => {
  test("hides a group and shows it again", () => {
    const hider = new Hider();
    const a = object();
    const b = object();

    hider.hide("mesh:tree", [a, b]);
    expect([a.visible, b.visible]).toEqual([false, false]);
    expect(hider.isHidden("mesh:tree")).toBe(true);

    hider.show("mesh:tree");
    expect([a.visible, b.visible]).toEqual([true, true]);
    expect(hider.keys()).toEqual([]);
  });

  test("an object in two hidden groups returns only when both are shown", () => {
    const hider = new Hider();
    const shared = object();

    hider.hide("mesh:tree", [shared]);
    hider.hide("material:bark", [shared]);
    hider.show("mesh:tree");
    expect(shared.visible).toBe(false);

    hider.show("material:bark");
    expect(shared.visible).toBe(true);
  });

  test("objects that were already invisible stay invisible", () => {
    const hider = new Hider();
    const off = object(false);

    hider.hide("mesh:ghost", [off]);
    hider.restoreAll();
    expect(off.visible).toBe(false);
  });

  test("restoreAll puts everything back and ignores non-objects", () => {
    const hider = new Hider();
    const a = object();
    const b = object();

    hider.hide("one", [a, null, 3]);
    hider.hide("two", [b]);
    hider.restoreAll();
    expect([a.visible, b.visible]).toEqual([true, true]);
    expect(hider.keys()).toEqual([]);
  });
});
