# @zkmake/three-textures

A dev panel for the textures in a three.js scene. See every texture the scene draws with, download
one, paint over it, and put it back: the scene shows your version right away, in the real renderer,
lighting and post-processing. Flip A/B against the original, keep swaps across reloads, and
live-link a file so every save in your paint app shows up in the running scene.

Compressed textures (KTX2, Basis) swap too: the panel reads them back from the GPU to a PNG you can
edit, and swaps your image in by binding an image twin with the same settings wherever the
original was used. Vanilla three and React Three Fiber.

```sh
bun add -d @zkmake/three-textures   # or npm i -D / pnpm add -D
```

Live demo: [three-kit.pages.dev/three-textures](https://three-kit.pages.dev/three-textures/), with a vanilla three and
a React Three Fiber take on the same scene: an image texture and a clone of it, a data texture, and
a KTX2 atlas cut into four cards. Download the atlas, paint on it, drop it back.

## Vanilla three

```ts
import { mountTexturePanel } from "@zkmake/three-textures/ui";

const panel = mountTexturePanel({ scene, renderer });
// later: panel.dispose()
```

## React Three Fiber

```tsx
import { TexturePanel } from "@zkmake/three-textures/react";

<Canvas>
  {import.meta.env.DEV && <TexturePanel />}
  {/* … */}
</Canvas>;
```

It reads the scene and renderer from the canvas and asks for a frame after each swap, so
`frameloop="demand"` works.

## What each row does

| Button                              | What it does                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| thumbnail                           | A large preview beside the panel, on the side facing the middle of the screen         |
| download                            | The swapped file; else the original file; else a GPU readback as PNG                  |
| replace (or drop a file on the row) | Swap an image in                                                                      |
| live link (Chrome, Edge)            | Pick a file once; every save re-applies it. Survives a reload (the browser asks once) |
| A/B (once swapped)                  | Show the original, keep the swap                                                      |
| undo (once swapped)                 | Put the original back and forget the swap                                             |

Swaps are kept in IndexedDB under `storageKey` (default `three-textures`) and come back on reload by
texture name. **Reset all** clears them.

## How a swap works

- **Image textures** swap in place: the texture's `Source` gets your image and every texture sharing
  it (clones included) re-uploads. Anything holding the texture, your own code included, sees the
  swap, and every setting stays.
- **Compressed and data textures** can't take an image in place, so each gets an image twin with its
  wrap, filters, colour space, uv channel and transform, bound into every material slot and uniform
  that held the original, including meshes mounted later. `flipY` is off, the way compressed and data
  textures lay their rows out, so a downloaded readback uploads back the same way up.

Downloads come out as the source image would: an sRGB texture is encoded back to sRGB, and a `flipY`
texture is turned back over. Readbacks and thumbnails of textures without a file need a
`WebGLRenderer`; with WebGPU they're skipped.

## The panel

It's the same frame as the three-meter HUD (three-meter's `mountDevPanel`): drag it by the grip disc
to any edge, the sliders disc shows or hides the list (compact is the brand label and the count), and
the blend disc dims it while the pointer is away. Both panels together:

```ts
mountPerfHud(monitor, { defaultPlacement: { edge: "left" } });
mountTexturePanel({ scene, renderer }); // right edge by default
```

## Options

```ts
mountTexturePanel({
  scene,
  renderer,
  // Textures to name (and list before the scene shows them), with the file each came from.
  textures: [{ name: "bunny", texture: bunnyTexture, src: bunnyUrl }],
  // Redraw anything derived from a swapped texture, such as an atlas built on a canvas.
  onSwap: ({ id, bound, state }) => rebuildAtlasFor(id, bound[0]),
  storageKey: "my-game", // null keeps swaps for this page only
  theme: "system", // or "dark", "light"
  defaultPlacement: { edge: "right", align: "start" },
  compact: false, // start with the list hidden (remembered after the first toggle)
});
```

Textures are found in every material's texture properties (not only three's named maps) and uniforms
(`ShaderMaterial`, custom shader materials), plus the scene's background and environment. A texture
held only by your code (never bound to a material) needs `textures` to be listed.

## In your own dev panel

`createTexturePanel(lab)` is the bare element, for a host with its own tabs. `TextureLab` is the
engine with no UI:

```ts
import { TextureLab } from "@zkmake/three-textures";
import { createTexturePanel } from "@zkmake/three-textures/ui";

const lab = new TextureLab({ scene, renderer });
const panel = createTexturePanel(lab);

tab.append(panel.element);
panel.setEdge("right"); // docked right: the preview opens on its left
panel.setActive(false); // pause the scene re-read while the tab is hidden

await lab.swap("bunny", file);
await lab.showOriginal("bunny", true);
```

## Examples

[`apps/site/src/demos/three-textures`](https://github.com/zkmake/three-kit/tree/main/apps/site/src/demos/three-textures)
is what runs at three-kit.pages.dev/three-textures: [`vanilla.ts`](https://github.com/zkmake/three-kit/blob/main/apps/site/src/demos/three-textures/vanilla.ts)
with `mountTexturePanel`, [`r3f.tsx`](https://github.com/zkmake/three-kit/blob/main/apps/site/src/demos/three-textures/r3f.tsx)
with `<TexturePanel />`, each beside the three-meter HUD. `?r3f` opens on Fiber.

## License

MIT
