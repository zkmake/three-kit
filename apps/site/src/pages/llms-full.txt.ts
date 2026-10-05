import type { APIRoute } from "astro";

import { llmsFullTxt, markdown } from "../llms.ts";

const GET: APIRoute = ({ site }) => markdown(llmsFullTxt(site!), "text/plain");

export { GET };
