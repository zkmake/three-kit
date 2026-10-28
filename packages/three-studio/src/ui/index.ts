/**
 * `@zkmake/three-studio/ui`: the DOM side. `mountStudio` wires a page around a renderer (view,
 * orbit controls, audit helpers, overlay, `window.studio`); `mountStudioOverlay` is the switchers
 * and readout alone.
 */
export {
  mountStudio,
  type MountStudioOptions,
  type StudioGlobal,
  type StudioHandle,
  type StudioRenderer,
} from "./mount.ts";
export { mountStudioOverlay, type StudioOverlay, type StudioOverlayOptions } from "./overlay.ts";
export { injectStyles, STUDIO_STYLES } from "./styles.ts";
