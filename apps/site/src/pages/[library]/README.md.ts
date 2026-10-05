import type { APIRoute, GetStaticPaths } from "astro";

import { LIBRARIES, type Library } from "../../libraries.ts";
import { markdown, readme } from "../../llms.ts";

/** Each package's README as plain markdown, beside its page: `/three-kit/three-meter/README.md`. */
const getStaticPaths = (() =>
  LIBRARIES.map((lib) => ({
    params: { library: lib.name },
    props: { lib },
  }))) satisfies GetStaticPaths;

const GET: APIRoute<{ lib: Library }> = ({ props, site }) => markdown(readme(props.lib, site!));

export { GET, getStaticPaths };
