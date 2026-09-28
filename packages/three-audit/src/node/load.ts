/**
 * Load a glTF model in Node for the checks: `.glb`, or `.gltf` with its buffers beside it.
 *
 * Textures are stripped before parsing: no check reads them, and decoding images needs a DOM.
 * Draco (`draco3dgltf`) and Meshopt (`meshoptimizer`) compressed geometry decode when those
 * packages are installed.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Group } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { createNodeDracoLoader } from "./draco.ts";

type Json = Record<string, unknown>;

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const TEXTURE_EXTENSIONS = [
  "KHR_texture_basisu",
  "KHR_texture_transform",
  "EXT_texture_webp",
  "EXT_texture_avif",
];

/** Every `…Texture` reference in a material, extensions included. */
const dropTextureRefs = (value: unknown) => {
  if (value === null || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (
      key.endsWith("Texture") &&
      child !== null &&
      typeof child === "object" &&
      "index" in child
    ) {
      delete (value as Json)[key];
    } else {
      dropTextureRefs(child);
    }
  }
};

const stripTextures = (json: Json) => {
  delete json.images;
  delete json.textures;
  delete json.samplers;
  dropTextureRefs(json.materials);

  for (const key of ["extensionsUsed", "extensionsRequired"]) {
    if (Array.isArray(json[key])) {
      json[key] = (json[key] as string[]).filter((name) => !TEXTURE_EXTENSIONS.includes(name));
    }
  }
};

const uses = (json: Json, extension: string) =>
  Array.isArray(json.extensionsUsed) && (json.extensionsUsed as string[]).includes(extension);

/** Split a GLB into its JSON and binary chunks. */
const readGlb = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let json: Json | null = null;
  let bin: Uint8Array | null = null;

  for (let offset = 12; offset < bytes.byteLength;) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);

    if (type === JSON_CHUNK) {
      json = JSON.parse(new TextDecoder().decode(chunk)) as Json;
    } else if (type === BIN_CHUNK) {
      bin = chunk;
    }

    offset += 8 + length;
  }

  if (!json) {
    throw new Error("three-audit: GLB has no JSON chunk");
  }

  return { json, bin };
};

/** A GLB from JSON and an optional binary chunk, each padded to four bytes. */
const writeGlb = (json: Json, bin: Uint8Array | null) => {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(text.byteLength / 4) * 4;
  const binLength = bin ? Math.ceil(bin.byteLength / 4) * 4 : 0;
  const total = 12 + 8 + jsonLength + (bin ? 8 + binLength : 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, JSON_CHUNK, true);
  out.fill(0x20, 20, 20 + jsonLength);
  out.set(text, 20);

  if (bin) {
    view.setUint32(20 + jsonLength, binLength, true);
    view.setUint32(24 + jsonLength, BIN_CHUNK, true);
    out.set(bin, 28 + jsonLength);
  }

  return out.buffer;
};

/** A buffer's bytes: the GLB's binary chunk, a data URI, or a file beside the model. */
const bufferBytes = async (
  buffer: { uri?: string },
  index: number,
  bin: Uint8Array | null,
  directory: string,
) => {
  if (buffer.uri === undefined) {
    if (index !== 0 || !bin) {
      throw new Error("three-audit: a buffer without a uri must be the GLB's binary chunk");
    }

    return bin;
  }

  if (buffer.uri.startsWith("data:")) {
    return new Uint8Array(Buffer.from(buffer.uri.slice(buffer.uri.indexOf(",") + 1), "base64"));
  }

  return new Uint8Array(await readFile(resolve(directory, decodeURIComponent(buffer.uri))));
};

/**
 * Every buffer folded into one binary chunk, the buffer views re-pointed into it. The result is a
 * self-contained GLB, so the loader never fetches: three's `FileLoader` needs browser globals.
 */
const packBuffers = async (json: Json, bin: Uint8Array | null, directory: string) => {
  const buffers = (json.buffers ?? []) as { uri?: string }[];
  const parts = await Promise.all(
    buffers.map((buffer, i) => bufferBytes(buffer, i, bin, directory)),
  );
  const offsets: number[] = [];
  let total = 0;

  for (const part of parts) {
    offsets.push(total);
    total += Math.ceil(part.byteLength / 4) * 4;
  }

  const packed = new Uint8Array(total);

  parts.forEach((part, i) => packed.set(part, offsets[i]));

  for (const view of (json.bufferViews ?? []) as { buffer: number; byteOffset?: number }[]) {
    view.byteOffset = (view.byteOffset ?? 0) + offsets[view.buffer]!;
    view.buffer = 0;
  }

  json.buffers = parts.length > 0 ? [{ byteLength: total }] : [];

  return parts.length > 0 ? packed : null;
};

/** Parse glTF bytes (GLB or JSON) into a three scene, textures stripped. */
export const parseModel = async (bytes: Uint8Array, directory = "."): Promise<Group> => {
  const isGlb =
    bytes.byteLength >= 12 &&
    new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true) === GLB_MAGIC;
  const { json, bin } = isGlb
    ? readGlb(bytes)
    : { json: JSON.parse(new TextDecoder().decode(bytes)) as Json, bin: null };

  stripTextures(json);

  const data = writeGlb(json, await packBuffers(json, bin, directory));
  const loader = new GLTFLoader();

  if (uses(json, "KHR_draco_mesh_compression")) {
    loader.setDRACOLoader((await createNodeDracoLoader()) as never);
  }

  if (uses(json, "EXT_meshopt_compression") || uses(json, "KHR_meshopt_compression")) {
    try {
      const { MeshoptDecoder } = await import("meshoptimizer");

      await MeshoptDecoder.ready;
      loader.setMeshoptDecoder(MeshoptDecoder);
    } catch {
      throw new Error(
        "three-audit: this model is Meshopt-compressed; install meshoptimizer to read it (npm i -D meshoptimizer)",
      );
    }
  }

  const gltf = await loader.parseAsync(data, "");

  return gltf.scene;
};

/** Read and parse a `.glb` or `.gltf` file into a three scene, ready for the checks. */
export const loadModel = async (path: string): Promise<Group> =>
  parseModel(await readFile(path), dirname(path));
