import type { APIRoute } from "astro";

import { llmsTxt, markdown } from "../llms.ts";

const GET: APIRoute = ({ site }) => markdown(llmsTxt(site!), "text/plain");

export { GET };
