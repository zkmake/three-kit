import type { APIRoute } from "astro";
/**
 * The sitemap, with each page's lastmod: the date of the last commit touching what the page shows
 * (the site for the kit's page; the package and its demo for a package page; the README for its
 * docs). Needs the full git history (CI checks out with fetch-depth 0); without it, the build date.
 */
import { execFileSync } from "node:child_process";

import { LIBRARIES } from "../libraries.ts";
import { url } from "../paths.ts";

const REPO_ROOT = new URL("../../../../", import.meta.url).pathname;
const today = new Date().toISOString().slice(0, 10);

/** `YYYY-MM-DD` of the last commit touching any of `paths` (repo-relative). */
const lastChanged = (paths: string[]) => {
  try {
    const date = execFileSync("git", ["log", "-1", "--format=%cs", "--", ...paths], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();

    return date || today;
  } catch {
    return today;
  }
};

const GET: APIRoute = ({ site }) => {
  const pages = [
    { path: url(), changed: lastChanged(["apps/site"]) },
    ...LIBRARIES.flatMap((lib) => {
      const page = {
        path: url(`${lib.name}/`),
        changed: lastChanged([
          `packages/${lib.name}`,
          `apps/site/src/pages/${lib.name}`,
          `apps/site/src/demos/${lib.name}`,
        ]),
      };
      const docs = {
        path: url(`${lib.name}/docs/`),
        changed: lastChanged([`packages/${lib.name}/README.md`]),
      };

      return lib.demo ? [page, docs] : [page];
    }),
  ];
  const urls = pages
    .map(
      ({ path, changed }) =>
        `  <url>\n    <loc>${new URL(path, site).href}</loc>\n    <lastmod>${changed}</lastmod>\n  </url>`,
    )
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml" } },
  );
};

export { GET };
