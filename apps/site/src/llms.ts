/**
 * The site for coding agents (llmstxt.org): `llms.txt` lists the packages with a link to each
 * README as plain markdown, and `llms-full.txt` is every README in one file. The READMEs are the
 * packages' own, as npm shows them; only their links to a sibling package (`../three-audit`, written
 * for GitHub) become absolute links to its page here.
 */
import audit from "../../../packages/three-audit/README.md?raw";
import batch from "../../../packages/three-batch/README.md?raw";
import cameras from "../../../packages/three-cameras/README.md?raw";
import meter from "../../../packages/three-meter/README.md?raw";
import textures from "../../../packages/three-textures/README.md?raw";
import { type Library, LIBRARIES, type LibraryName, REPO_URL } from "./libraries.ts";
import { url } from "./paths.ts";

const READMES: Record<LibraryName, string> = {
  "three-meter": meter,
  "three-textures": textures,
  "three-cameras": cameras,
  "three-audit": audit,
  "three-batch": batch,
};
const SIBLING = /\]\(\.\.\/(three-[a-z]+)\/?\)/g;

/** A page on the site as an absolute URL, for readers that fetch it out of context. */
const absolute = (site: URL, path = "") => new URL(url(path), site).href;

/** A package's README, with its sibling links pointed at the site. */
const readme = ({ name }: Library, site: URL) =>
  READMES[name].replace(SIBLING, (_, sibling: string) => `](${absolute(site, `${sibling}/`)})`);

const shipped = LIBRARIES.filter((lib) => !lib.dev).map((lib) => lib.name);
const devTools = shipped.length
  ? `All but ${shipped.join(" and ")} are dev tools (install with \`-D\`); ${shipped.join(" and ")} ${shipped.length > 1 ? "ship" : "ships"} with the app.`
  : "All are dev tools (install with `-D`).";

/**
 * The kit in a few lines, written by hand: keep it true when a package joins or leaves, or the
 * kit's reach (renderers, React) or its entry-point layout changes. The rest comes from the
 * READMEs and libraries.ts.
 */
const header = `# three-kit

> Dev tools and helpers for three.js, published separately under \`@zkmake/*\`: a live FPS, CPU and GPU HUD, texture and camera inspectors, scene checks for tests and CI, and draw-call batching. Each works with vanilla three and React Three Fiber, WebGL and WebGPU.

Each package installs on its own. ${devTools} Entry points: the core at \`@zkmake/<name>\`, a DOM panel at \`/ui\` and React Three Fiber components at \`/react\`, where a package has them.`;

const llmsTxt = (site: URL) => {
  const packages = LIBRARIES.map(
    (lib) =>
      `- [@zkmake/${lib.name}](${absolute(site, `${lib.name}/README.md`)}): ${lib.job}. ${lib.summary}${lib.dev ? "" : " Ships with the app, not a dev tool."}`,
  );
  const demos = LIBRARIES.filter((lib) => lib.demo).map(
    (lib) => `- [${lib.name} demo](${absolute(site, `${lib.name}/`)}): the package running live`,
  );

  return `${header}

## Packages

${packages.join("\n")}

## Optional

- [Every README in one file](${absolute(site, "llms-full.txt")})
${demos.join("\n")}
- [Source](${REPO_URL}): monorepo, with each package's CHANGELOG.md under packages/<name>/
`;
};

const llmsFullTxt = (site: URL) =>
  `${header}\n\n${LIBRARIES.map((lib) => readme(lib, site).trim()).join("\n\n---\n\n")}\n`;

/** Markdown served as text, so a browser shows it rather than downloading it. */
const markdown = (body: string, type = "text/markdown") =>
  new Response(body, { headers: { "Content-Type": `${type}; charset=utf-8` } });

export { llmsFullTxt, llmsTxt, markdown, readme };
