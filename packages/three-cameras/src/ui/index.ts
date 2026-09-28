/**
 * `@zkmake/three-cameras/ui`: the panel. `mountCameraPanel` is the one-liner (a docked card);
 * `createCameraPanel` is the bare element, for a host with its own dev panel and tabs.
 */

export { mountCameraPanel } from "./mount.ts";
export type { CameraPanelHandle, MountCameraPanelOptions } from "./mount.ts";
export { createCameraPanel } from "./panel.ts";
export type { CameraPanel } from "./panel.ts";
export { CAMERA_PANEL_STYLES, injectStyles } from "./styles.ts";
export { createTimelinePanel } from "./timeline.ts";
export type { TimelinePanel } from "./timeline.ts";
