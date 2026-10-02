/**
 * Converts the repo's `docs/*.png` (the screenshots the package READMEs show) to WebP under
 * `public/docs/`, so the site's docs pages serve them itself, cached with the site, instead of
 * hotlinking raw.githubusercontent.com. readme-links.ts points the READMEs' images at them.
 *
 * Needs `cwebp` on the PATH. Run from the app: `bun run docs-images`. The outputs are committed;
 * this is how they were made.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";

const DOCS = new URL("../../../docs/", import.meta.url).pathname;
const OUT = new URL("../public/docs/", import.meta.url).pathname;

mkdirSync(OUT, { recursive: true });

const pngs = readdirSync(DOCS).filter((name) => name.endsWith(".png"));

for (const name of pngs) {
  execFileSync("cwebp", [
    "-quiet",
    "-q",
    "86",
    `${DOCS}${name}`,
    "-o",
    `${OUT}${name.replace(/\.png$/, ".webp")}`,
  ]);
}

// oxlint-disable-next-line no-console -- a script's report
console.log(`wrote ${pngs.length} images to public/docs/`);
