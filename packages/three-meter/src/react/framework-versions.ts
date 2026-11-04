import fiber from "@react-three/fiber/package.json" with { type: "json" };
import { version as react } from "react";

import type { FrameworkVersions } from "../core/types.ts";

/**
 * The React and React Three Fiber this app runs: the HUD's footer and report list them beside
 * three. R3F exports no version, so it comes from its package.json, which every release allows.
 */
const frameworkVersions: FrameworkVersions = { react, r3f: fiber.version };

export { frameworkVersions };
