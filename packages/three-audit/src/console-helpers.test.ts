import { BoxGeometry, Mesh, MeshBasicMaterial, Scene } from "three";
import { afterEach, describe, expect, test } from "vitest";

import { auditScene } from "./audit-scene.ts";
import { installAuditHelpers } from "./console-helpers.ts";

const scope = globalThis as Record<string, unknown>;
const call = (name: string, ...args: unknown[]) =>
  (scope[name] as (...a: unknown[]) => unknown)(...args);

const scene = () => {
  const material = new MeshBasicMaterial();
  const a = new Mesh(new BoxGeometry(), material);
  const b = new Mesh(new BoxGeometry(), material);

  a.name = "a";
  b.name = "b";

  return new Scene().add(a, b);
};

describe("installAuditHelpers", () => {
  let uninstall = () => {};

  afterEach(() => uninstall());

  test("puts the checks on globalThis and takes them off again", () => {
    const root = scene();

    uninstall = installAuditHelpers(root);

    expect(scope.auditRoot).toBe(root);
    expect(call("tris")).toBe(24);
    expect(call("meshes")).toHaveLength(2);
    expect(call("census")).toHaveLength(2);
    expect(call("audit")).toEqual([]);
    expect(call("zfight")).toHaveLength(1);
    expect(call("zfight", 0.004, false)).toHaveLength(1);
    expect(call("report")).toEqual(auditScene(root));
    expect(() => call("ledger")).toThrow(/renderer/);

    uninstall();
    expect(scope.tris).toBeUndefined();
    expect(scope.auditRoot).toBeUndefined();
  });

  test("leaves a newer install's globals alone", () => {
    const first = installAuditHelpers(scene());

    uninstall = installAuditHelpers(scene());
    first();

    expect(typeof scope.tris).toBe("function");
  });
});

describe("auditScene", () => {
  test("is JSON-safe", () => {
    const report = auditScene(scene(), { top: 1 });

    expect(JSON.parse(JSON.stringify(report))).toEqual({
      triangles: 24,
      zFighting: [
        { a: expect.stringMatching(/^a /), b: expect.stringMatching(/^b /), triangles: 12 },
      ],
      badGeometry: [],
      meshes: [{ name: "a", triangles: 12, instances: 1, total: 12 }],
    });
  });
});
