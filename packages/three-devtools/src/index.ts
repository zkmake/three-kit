/**
 * `@zkmake/three-devtools`: an app's dev tools behind `?debug`, in one call. `mountDevTools` for
 * vanilla three; `<DevTools />` inside a React Three Fiber `<Canvas>` is `./react`. three-meter and
 * three-audit load through `import()` only when on; the panels are the app's own `import()`s.
 */

export { hasDebugFlag, mountDevTools } from "./mount-dev-tools.ts";
export type {
  CamerasModule,
  DevHudOptions,
  DevPanels,
  DevToolsHandle,
  MountDevToolsOptions,
  PanelMountOptions,
  TexturesModule,
} from "./mount-dev-tools.ts";
