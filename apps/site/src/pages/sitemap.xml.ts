import type { APIRoute } from "astro";

import { LIBRARIES } from "../libraries.ts";

const GET: APIRoute = ({ site }) => {
  const paths = [
    "/",
    ...LIBRARIES.flatMap((lib) =>
      lib.demo ? [`/${lib.name}/`, `/${lib.name}/docs/`] : [`/${lib.name}/`],
    ),
  ];
  const urls = paths
    .map((path) => `  <url>\n    <loc>${new URL(path, site).href}</loc>\n  </url>`)
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml" } },
  );
};

export { GET };
