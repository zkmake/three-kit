import type { APIRoute } from "astro";

import { url } from "../paths.ts";

const GET: APIRoute = ({ site }) =>
  new Response(
    `User-agent: *\nAllow: ${url()}\n\nSitemap: ${new URL(url("sitemap.xml"), site).href}\n`,
  );

export { GET };
