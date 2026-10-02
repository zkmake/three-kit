/**
 * Makes the site's icons from each mark: `public/favicon.svg` for the kit and
 * `public/<library>/favicon.svg` for each library. Per mark: `apple-touch-icon.png` (180) and
 * `favicon-32.png`; plus the kit's `favicon.ico`. The share images are scripts/make-og.ts.
 *
 * Needs ImageMagick 7 (`magick`) on the PATH. Run from the app: `bun run icons`. The outputs are
 * committed; this is how they were made.
 */
import { execFileSync } from "node:child_process";

import { LIBRARIES } from "../src/libraries.ts";

const PUBLIC = new URL("../public/", import.meta.url).pathname;
/** Folders under public/ with a mark: "" for the kit. */
const DIRS = ["", ...LIBRARIES.map(({ name }) => name)];

const magick = (args: string[]) => execFileSync("magick", args);

for (const name of DIRS) {
  const dir = `${PUBLIC}${name ? `${name}/` : ""}`;
  const svg = `${dir}favicon.svg`;

  const icon = (density: string, size: string, out: string) =>
    magick(["-background", "none", "-density", density, svg, "-resize", size, "-depth", "8", out]);

  icon("384", "180x180", `PNG32:${dir}apple-touch-icon.png`);
  icon("96", "32x32", `PNG32:${dir}favicon-32.png`);
}

magick([
  "-background",
  "none",
  "-density",
  "96",
  `${PUBLIC}favicon.svg`,
  "-define",
  "icon:auto-resize=48,32,16",
  `${PUBLIC}favicon.ico`,
]);

// oxlint-disable-next-line no-console -- a script's report
console.log(`wrote icons for ${DIRS.map((name) => name || "three-kit").join(", ")}`);
