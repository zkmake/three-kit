import type { APIRoute } from "astro";
/**
 * The sitemap, with each page's lastmod: the date of the last commit touching what the page shows
 * (the site for the kit's page; the package for a package page, its README; the package and its
 * demo for a demo page). A demo package's old `/docs/` forward is left out. Needs the full git history (CI checks out with fetch-depth 0); without it, the build date.
 */
import { execFileSync } from "node:child_process";

import { LIBRARIES } from "../libraries.ts";
import { url } from "../paths.ts";
import { PLUGIN, SKILLS } from "../skills.ts";

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
          `apps/site/src/pages/${lib.name}/index.astro`,
        ]),
      };
      const demo = {
        path: url(`${lib.name}/demo/`),
        changed: lastChanged([
          `packages/${lib.name}`,
          `apps/site/src/pages/${lib.name}/demo.astro`,
          `apps/site/src/demos/${lib.name}`,
        ]),
      };

      return lib.demo ? [page, demo] : [page];
    }),
    { path: PLUGIN.href, changed: lastChanged(["plugins", "apps/site/src/pages/skills"]) },
    ...SKILLS.flatMap((skill) => {
      const folder = `plugins/${PLUGIN.name}/skills/${skill.name}`;

      return [
        { path: skill.href, changed: lastChanged([`${folder}/SKILL.md`]) },
        ...skill.references.map((reference) => ({
          path: reference.href,
          changed: lastChanged([`${folder}/references/${reference.slug}.md`]),
        })),
      ];
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
