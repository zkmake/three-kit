import type { Material, Object3D } from "three";

/** What the readout needs of a renderer: `WebGLRenderer` and `WebGPURenderer` both fit. */
export type StatsRenderer = { info: { render: { calls: number; triangles: number } } };

export type FrameStats = { calls: number; triangles: number };

/**
 * The draws and triangles of the renderer's last `render()` call, shadow passes included. A
 * composer that renders several passes reports its last one only; three-audit's `ledger()` counts
 * every pass.
 */
export const frameStats = (renderer: StatsRenderer): FrameStats => ({
  calls: renderer.info.render.calls,
  triangles: renderer.info.render.triangles,
});

/** `"12 calls · 34,567 tris"`, the line every studio page shows. */
export const formatStats = ({ calls, triangles }: FrameStats): string =>
  `${calls} calls · ${triangles.toLocaleString("en-US")} tris`;

const materialsOf = (object: Object3D): Material[] => {
  const material = (object as Object3D & { material?: Material | Material[] }).material;

  return Array.isArray(material) ? material : material ? [material] : [];
};

/**
 * Draws every material under `root` as wireframe, or puts back what each had. Cheap enough to
 * call each frame, so meshes that mount later are covered too.
 */
export function setWireframe(root: Object3D, on: boolean) {
  root.traverse((object) => {
    for (const material of materialsOf(object)) {
      const wire = material as Material & { wireframe?: boolean };

      if (!("wireframe" in wire)) {
        continue;
      }

      const saved = material.userData.studioWireframe as boolean | undefined;

      if (on && saved === undefined) {
        material.userData.studioWireframe = Boolean(wire.wireframe);
        wire.wireframe = true;
      } else if (!on && saved !== undefined) {
        wire.wireframe = saved;
        delete material.userData.studioWireframe;
      }
    }
  });
}
