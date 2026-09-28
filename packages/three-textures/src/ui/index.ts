/**
 * `@zkmake/three-textures/ui`: the panel. `mountTexturePanel` is the one-liner (a docked card);
 * `createTexturePanel` is the bare element, for a host with its own dev panel and tabs.
 */

export { mountTexturePanel } from "./mount.ts";
export type { MountTexturePanelOptions, TexturePanelHandle } from "./mount.ts";
export { createTexturePanel } from "./panel.ts";
export type { PanelEdge, TexturePanel } from "./panel.ts";
export { injectStyles, TEXTURE_PANEL_STYLES } from "./styles.ts";
