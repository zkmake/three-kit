import { BoxGeometry, Mesh, MeshBasicMaterial, Scene } from "three";
import { afterEach, describe, expect, test, vi } from "vitest";

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
    expect(scope.threeAudit).toBeUndefined();
  });

  test("puts them on threeAudit too, and only there with globals: false", () => {
    uninstall = installAuditHelpers(scene(), { globals: false });

    const namespace = scope.threeAudit as Record<string, (...a: unknown[]) => unknown>;

    expect(scope.tris).toBeUndefined();
    expect(namespace.tris!()).toBe(24);
    expect(namespace.zfight!()).toHaveLength(1);
  });

  test("beginLedger brackets draws by hand; ledger({ render }) records one call", async () => {
    const draws: string[] = [];
    const renderer = {
      render: () => {},
      renderBufferDirect: (..._args: unknown[]) => draws.push("draw"),
      getContext: () => null,
      getRenderTarget: () => null,
    };
    const drawOnce = () =>
      renderer.renderBufferDirect(null, null, null, { type: "M" }, { name: "box" }, null);

    vi.spyOn(console, "group").mockImplementation(() => {});
    vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
    vi.spyOn(console, "groupEnd").mockImplementation(() => {});
    vi.spyOn(console, "table").mockImplementation(() => {});
    uninstall = installAuditHelpers(scene(), { renderer: renderer as never });

    const recording = (call("beginLedger") as { end: () => { draws: number } }) ?? null;

    drawOnce();
    drawOnce();
    expect(recording.end().draws).toBe(2);

    const ledger = (await call("ledger", { render: drawOnce })) as { objects: { name: string }[] };

    expect(ledger.objects).toEqual([{ name: "box", total: 1, passes: { direct: 1 } }]);
    vi.restoreAllMocks();
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
        {
          a: expect.stringMatching(/^a /),
          b: expect.stringMatching(/^b /),
          triangles: 12,
          planes: expect.any(Array),
          overlap: { area: 6, centre: [0, 0, 0] },
          count: 1,
        },
      ],
      badGeometry: [],
      meshes: [
        { name: "a", material: "MeshBasicMaterial", triangles: 12, instances: 1, total: 12 },
      ],
    });
  });
});
