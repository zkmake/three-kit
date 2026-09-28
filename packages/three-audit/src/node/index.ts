/**
 * `@zkmake/three-audit/node`: load glTF models in Node for the checks, e.g. in a test:
 *
 *   const scene = await loadModel("assets/windmill.glb");
 *   expect(findZFighting(scene)).toEqual([]);
 */

export { loadModel, parseModel } from "./load.ts";
export { createNodeDracoLoader } from "./draco.ts";
