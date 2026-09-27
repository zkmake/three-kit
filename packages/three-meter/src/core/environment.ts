/**
 * What the monitor is running on: three revision, rendering backend, GPU.
 * Read from the renderer and the page, never from an import of three.
 *
 * `WebGPURenderer` settles its backend in `init()`, so until then the backend
 * reads `null`; callers poll and the monitor caches once it is known.
 */
import type { Environment, PerfRenderer, RenderBackend } from "./types.ts";

type BackendShape = {
  device?: { adapterInfo?: AdapterInfoShape } | null;
  gl?: unknown;
  isWebGLBackend?: boolean;
  isWebGPUBackend?: boolean;
  parameters?: { forceWebGL?: boolean };
};

type AdapterInfoShape = {
  architecture?: string;
  description?: string;
  device?: string;
  vendor?: string;
};

type DebugRendererInfoExt = { readonly UNMASKED_RENDERER_WEBGL: number };

/** three sets `window.__THREE__` to its revision on import (and warns on a second copy). */
const readThreeRevision = (): string | null => {
  const revision = (globalThis as { __THREE__?: unknown }).__THREE__;

  return typeof revision === "string" && revision !== "" ? revision : null;
};

/**
 * Trim a WebGL renderer string to the part a person recognises. Chrome wraps
 * it in ANGLE, e.g. `ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786)
 * Direct3D11 vs_5_0 ps_5_0, D3D11)` or `ANGLE (Apple, ANGLE Metal Renderer:
 * Apple M3 Pro, Unspecified Version)`.
 */
const cleanGpuName = (raw: string): string => {
  let name = raw.trim();
  const angle = /^ANGLE \((.*)\)$/.exec(name);

  if (angle) {
    const parts = angle[1]!.split(", ");
    name = parts[1] ?? parts[0]!;
  }

  return name
    .replace(/^ANGLE [\w ]+ Renderer: /, "")
    .replace(/ \(0x[0-9a-f]+\)/i, "")
    .replace(/ (Direct3D\d*|OpenGL|Vulkan|Metal)\b.*$/, "")
    .trim();
};

const webglGpuName = (gl: WebGLRenderingContext | WebGL2RenderingContext): string | null => {
  // Firefox deprecates the extension but already returns the unmasked name from RENDERER.
  const ext = gl.getExtension("WEBGL_debug_renderer_info") as DebugRendererInfoExt | null;
  const raw = gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) as unknown;

  return typeof raw === "string" && raw !== "" && raw !== "WebKit WebGL" ? cleanGpuName(raw) : null;
};

/** WebGPU reports vendors lowercase (`apple`, `nvidia`). */
const VENDOR_NAMES: Record<string, string> = {
  amd: "AMD",
  apple: "Apple",
  arm: "Arm",
  intel: "Intel",
  nvidia: "NVIDIA",
  qualcomm: "Qualcomm",
};

/**
 * `GPUDevice.adapterInfo`. Chrome leaves `description` empty to limit
 * fingerprinting, so this is usually vendor + architecture: `Apple metal-3`.
 */
const webgpuGpuName = (info: AdapterInfoShape | undefined): string | null => {
  if (!info) {
    return null;
  }

  if (info.description) {
    return info.description;
  }

  const vendor = info.vendor ? (VENDOR_NAMES[info.vendor] ?? info.vendor) : "";
  const name = [vendor, info.architecture].filter(Boolean).join(" ");

  return name === "" ? null : name;
};

const isWebglContext = (value: unknown): value is WebGLRenderingContext | WebGL2RenderingContext =>
  (typeof WebGL2RenderingContext !== "undefined" && value instanceof WebGL2RenderingContext) ||
  (typeof WebGLRenderingContext !== "undefined" && value instanceof WebGLRenderingContext);

const webglBackend = (gl: WebGLRenderingContext | WebGL2RenderingContext): RenderBackend =>
  typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext
    ? "webgl2"
    : "webgl";

const readEnvironment = (renderer: PerfRenderer): Environment => {
  const three = readThreeRevision();
  const backend = renderer.backend as BackendShape | undefined;

  // WebGPURenderer. Read the backend's own fields: `getContext()` before
  // `init()` is what the GPU timer learned not to touch.
  if (backend) {
    if (backend.isWebGPUBackend) {
      const device = backend.device;

      return device
        ? { backend: "webgpu", fallback: false, gpu: webgpuGpuName(device.adapterInfo), three }
        : { backend: null, fallback: false, gpu: null, three };
    }

    if (backend.isWebGLBackend && isWebglContext(backend.gl)) {
      return {
        backend: webglBackend(backend.gl),
        fallback: backend.parameters?.forceWebGL !== true,
        gpu: webglGpuName(backend.gl),
        three,
      };
    }

    return { backend: null, fallback: false, gpu: null, three };
  }

  // WebGLRenderer.
  const context = renderer.getContext?.();

  return isWebglContext(context)
    ? { backend: webglBackend(context), fallback: false, gpu: webglGpuName(context), three }
    : { backend: null, fallback: false, gpu: null, three };
};

export { cleanGpuName, readEnvironment };
