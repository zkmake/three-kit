import { BoxGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, TorusGeometry } from "three";
import { describe, expect, test } from "vitest";

import { simplify, simplifyReport, weld } from "./index.ts";

describe("simplify", () => {
  test("a dense sphere collapses; the far copy shares its vertex buffers", () => {
    const sphere = weld(new SphereGeometry(1, 64, 32));

    sphere.name = "ball";

    const far = simplify(sphere, 0.02)!;

    expect(far.index!.count).toBeLessThan(sphere.index!.count / 4);
    expect(far.attributes.position).toBe(sphere.attributes.position);
    expect(far.name).toBe("ball:far");
  });

  test("null when it would save little", () => {
    expect(simplify(weld(new BoxGeometry()), 0.02)).toBeNull();
  });

  test("refuses unindexed geometry", () => {
    expect(() => simplify(new BoxGeometry().toNonIndexed(), 0.02)).toThrow(/weld it first/);
  });
});

describe("simplifyReport", () => {
  test("totals per tagged object, full then each error", () => {
    const material = new MeshBasicMaterial();
    const tagged = new Group();

    tagged.userData.studioObject = "donut";
    tagged.add(new Mesh(new TorusGeometry(1, 0.4, 32, 64), material));

    const root = new Group().add(tagged, new Mesh(new SphereGeometry(), material));
    const report = simplifyReport(root, [0.005, 0.05]);

    expect(Object.keys(report)).toEqual(["donut"]);

    const [full, fine, coarse] = report.donut!;

    expect(full).toBe(4096);
    expect(fine).toBeLessThan(full!);
    expect(coarse).toBeLessThan(fine!);
  });
});
