/**
 * Read a texture back from the GPU as pixels: the one way to see (and save) a compressed, data or
 * generated texture, which has no file behind it. WebGL only.
 *
 * The texture is drawn onto a quad in a render target the size asked for, sampled raw (no uv
 * transform), and read back. Two corrections make the PNG a file an artist can edit and upload
 * back unchanged:
 * - Rows: three uploads an image with `flipY` bottom row first, so its readback is flipped back;
 *   a `flipY: false` texture (compressed, data, glTF) is written in the order it was uploaded.
 * - Colour: an sRGB texture samples as linear, so it's encoded back to sRGB bytes.
 */
import {
  GLSL3,
  Mesh,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RGBAFormat,
  SRGBColorSpace,
  type Texture,
  UnsignedByteType,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";

const VERTEX = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D map;
uniform bool encodeSRGB;
in vec2 vUv;
out vec4 color;

vec3 toSRGB(vec3 linear) {
  return mix(linear * 12.92, 1.055 * pow(linear, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, linear));
}

void main() {
  vec4 texel = texture(map, vUv);

  color = encodeSRGB ? vec4(toSRGB(texel.rgb), texel.a) : texel;
}
`;

/** WebGL ignores `flipY` for an `ImageBitmap`: it always uploads top row first. */
export const uploadsFlipped = (texture: Texture) =>
  texture.flipY &&
  !(typeof ImageBitmap !== "undefined" && texture.source.data instanceof ImageBitmap);

let quad: Mesh<PlaneGeometry, RawShaderMaterial> | null = null;
const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

const quadFor = (texture: Texture) => {
  quad ??= new Mesh(
    new PlaneGeometry(2, 2),
    new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { map: { value: null }, encodeSRGB: { value: false } },
      depthTest: false,
      depthWrite: false,
    }),
  );
  quad.frustumCulled = false;
  quad.material.uniforms.map!.value = texture;
  quad.material.uniforms.encodeSRGB!.value = texture.colorSpace === SRGBColorSpace;

  return quad;
};

/**
 * Draws `texture` raw into a new render target of `width × height` and puts the renderer back as
 * it was. The caller reads the target and disposes it.
 */
const drawToTarget = (renderer: WebGLRenderer, texture: Texture, width: number, height: number) => {
  const target = new WebGLRenderTarget(width, height, {
    type: UnsignedByteType,
    format: RGBAFormat,
    colorSpace: NoColorSpace,
    depthBuffer: false,
  });
  const previous = renderer.getRenderTarget();
  const xr = renderer.xr.enabled;
  const autoClear = renderer.autoClear;

  try {
    renderer.xr.enabled = false;
    renderer.autoClear = true;
    renderer.setRenderTarget(target);
    renderer.render(quadFor(texture), camera);
  } catch (error) {
    target.dispose();
    throw error;
  } finally {
    renderer.setRenderTarget(previous);
    renderer.xr.enabled = xr;
    renderer.autoClear = autoClear;
    quad!.material.uniforms.map!.value = null;
  }

  return target;
};

/**
 * The render target's rows as an image. Row 0 is the texture's first uploaded row: a `flipY`
 * texture uploaded its image bottom row first, so turning it back over gives the image; otherwise
 * keep the order.
 */
const toImageData = (pixels: Uint8Array, texture: Texture, width: number, height: number) => {
  const out = new ImageData(width, height);
  const row = width * 4;
  const flipped = uploadsFlipped(texture);

  for (let y = 0; y < height; y += 1) {
    const from = flipped ? height - 1 - y : y;

    out.data.set(pixels.subarray(from * row, from * row + row), y * row);
  }

  return out;
};

/** Pixels of `texture` at `width × height`, top row first, as they'd be saved to a file. */
export const readTexture = (
  renderer: WebGLRenderer,
  texture: Texture,
  width: number,
  height: number,
): ImageData => {
  const target = drawToTarget(renderer, texture, width, height);
  const pixels = new Uint8Array(width * height * 4);

  try {
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  } finally {
    target.dispose();
  }

  return toImageData(pixels, texture, width, height);
};

/**
 * `readTexture` without holding up the page: WebGL2 reads through a fence, so the main thread
 * doesn't wait for the GPU to finish everything queued before it (on a page's first frames, its
 * shader compiles). Falls back to the blocking read where the renderer has no async one.
 */
export const readTextureAsync = async (
  renderer: WebGLRenderer,
  texture: Texture,
  width: number,
  height: number,
): Promise<ImageData> => {
  if (typeof renderer.readRenderTargetPixelsAsync !== "function") {
    return readTexture(renderer, texture, width, height);
  }

  const target = drawToTarget(renderer, texture, width, height);
  const pixels = new Uint8Array(width * height * 4);

  try {
    await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height, pixels);
  } finally {
    target.dispose();
  }

  return toImageData(pixels, texture, width, height);
};

/** `readTexture` as a PNG. */
export const readTextureBlob = async (
  renderer: WebGLRenderer,
  texture: Texture,
  width: number,
  height: number,
): Promise<Blob> => {
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.putImageData(readTexture(renderer, texture, width, height), 0, 0);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png",
    ),
  );
};

/** Whether this renderer can read textures back (WebGL, not WebGPU). */
export const canReadBack = (renderer: unknown): renderer is WebGLRenderer =>
  renderer !== null &&
  typeof renderer === "object" &&
  typeof (renderer as WebGLRenderer).readRenderTargetPixels === "function" &&
  (renderer as { isWebGLRenderer?: boolean }).isWebGLRenderer === true;
