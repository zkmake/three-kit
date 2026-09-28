/**
 * Hand-built glTF for the loader and CLI tests: quads in the XZ plane at chosen heights, each its
 * own mesh and node. `textured` adds an image, texture and material reference the loader must
 * strip (the image bytes are junk; decoding them would throw).
 */

type Quad = { name: string; y: number; size?: number };

const quadPositions = ({ y, size = 1 }: Quad) => {
  const h = size / 2;

  return [-h, y, -h, h, y, -h, h, y, h, -h, y, -h, h, y, h, -h, y, h];
};

export const gltfJson = (quads: Quad[], { textured = false } = {}) => {
  const positions = new Float32Array(quads.flatMap(quadPositions));
  const bytes = new Uint8Array(positions.buffer);
  const json: Record<string, unknown> = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: quads.map((_, i) => i) }],
    nodes: quads.map((quad, i) => ({ name: quad.name, mesh: i })),
    meshes: quads.map((quad, i) => ({
      name: quad.name,
      primitives: [{ attributes: { POSITION: i }, ...(textured ? { material: 0 } : {}) }],
    })),
    accessors: quads.map((quad, i) => {
      const h = (quad.size ?? 1) / 2;

      return {
        bufferView: i,
        componentType: 5126,
        count: 6,
        type: "VEC3",
        min: [-h, quad.y, -h],
        max: [h, quad.y, h],
      };
    }),
    bufferViews: quads.map((_, i) => ({ buffer: 0, byteOffset: i * 72, byteLength: 72 })),
    buffers: [{ byteLength: bytes.byteLength }],
  };

  if (textured) {
    json.images = [{ uri: "data:image/png;base64,bm90IGEgcG5n" }];
    json.textures = [{ source: 0 }];
    json.materials = [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }];
    json.extensionsUsed = ["KHR_texture_transform"];
  }

  return { json, bytes };
};

/** The same as a GLB: JSON chunk, then the binary chunk. */
export const glb = (quads: Quad[], options: { textured?: boolean } = {}) => {
  const { json, bytes } = gltfJson(quads, options);
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(text.byteLength / 4) * 4;
  const out = new Uint8Array(12 + 8 + jsonLength + 8 + bytes.byteLength);
  const view = new DataView(out.buffer);

  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.byteLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jsonLength);
  out.set(text, 20);
  view.setUint32(20 + jsonLength, bytes.byteLength, true);
  view.setUint32(24 + jsonLength, 0x004e4942, true);
  out.set(bytes, 28 + jsonLength);

  return out;
};
