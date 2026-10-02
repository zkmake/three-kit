import type { SatteriProcessorOptions } from "@astrojs/markdown-satteri";
/**
 * The docs pages render each package's README, whose relative links are written for GitHub. This
 * points them where they resolve from the site: a sibling package (`../three-audit`) to its page
 * here (under the site's base), anything else in the repo to GitHub (images to the raw file).
 * Anchors and absolute URLs stay as they are, except the repo's `docs/` screenshots: the READMEs
 * load them from raw.githubusercontent.com (so npm shows them), and here they come from the site's
 * own WebP copies (`bun run docs-images`), with a height to match their width so nothing shifts.
 */
import { existsSync, readFileSync } from "node:fs";

type Plugin = NonNullable<SatteriProcessorOptions["mdastPlugins"]>[number];

const REPO = "zkmake/three-kit";
const PACKAGE = /\/packages\/(three-[a-z]+)\/README\.md$/;
const SIBLING = /^\.\.\/(three-[a-z]+)\/?$/;

/** The site itself: README links to it are absolute, for npm and GitHub readers. */
const SITE = /^https:\/\/zkmake\.github\.io\/three-kit\//;

/** A screenshot in the repo's docs/, as the READMEs write it. */
const DOCS_IMAGE = new RegExp(
  `https://raw\\.githubusercontent\\.com/${REPO}/main/docs/([\\w-]+)\\.png`,
);

/** A PNG's pixel size, from its header. */
const pngSize = (file: URL) => {
  const header = readFileSync(file).subarray(16, 24);

  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) };
};

/**
 * An `<img>` of a docs/ screenshot, served from the site when its WebP copy exists: the src moves,
 * and a height joins the README's width (or both come from the file).
 */
const localImage = (tag: string, base: string, root: URL) => {
  const name = DOCS_IMAGE.exec(tag)?.[1];
  const png = name && new URL(`docs/${name}.png`, root);

  if (!name || !png || !existsSync(new URL(`apps/site/public/docs/${name}.webp`, root))) {
    return tag;
  }

  const size = pngSize(png);
  const width = Number(/\swidth="(\d+)"/.exec(tag)?.[1] ?? size.width);
  const height = Math.round((width * size.height) / size.width);
  const sized = /\sheight="/.test(tag)
    ? tag
    : tag.replace(/<img\b/, `<img height="${height}" loading="lazy" decoding="async"`);

  return sized
    .replace(DOCS_IMAGE, `${base}docs/${name}.webp`)
    .replace(/<img\b(?![^>]*\swidth=)/, `<img width="${width}"`);
};

const rewrite = (url: string, pkg: string, raw: boolean, base: string) => {
  // On the site itself, a link to the site goes to this copy of it.
  if (SITE.test(url)) {
    return url.replace(SITE, base);
  }

  if (/^([a-z]+:|\/|#)/i.test(url)) {
    return url;
  }

  const sibling = SIBLING.exec(url);

  if (sibling) {
    return `${base}${sibling[1]}/`;
  }

  const path = new URL(url, `https://x/packages/${pkg}/`).pathname.slice(1);

  return raw
    ? `https://raw.githubusercontent.com/${REPO}/main/${path}`
    : `https://github.com/${REPO}/blob/main/${path}`;
};

/**
 * Runs on a package README only; other markdown gets no plugin. `base` is the site's, so sibling
 * links land under it; `root` is the repo's, where docs/ and the site's public/docs/ are found.
 */
const readmeLinks =
  (base: string, root: URL): Plugin =>
  ({ fileURL }) => {
    const pkg = PACKAGE.exec(fileURL?.pathname ?? "")?.[1];

    if (!pkg) {
      return null;
    }

    return {
      name: "readme-links",
      link: (node, ctx) => {
        ctx.setProperty(node, "url", rewrite(node.url, pkg, false, base));
      },
      image: (node, ctx) => {
        ctx.setProperty(node, "url", rewrite(node.url, pkg, true, base));
      },
      html: (node, ctx) => {
        const value = node.value.replace(/<img\b[^>]*>/g, (tag) => localImage(tag, base, root));

        if (value !== node.value) {
          ctx.setProperty(node, "value", value);
        }
      },
    };
  };

export { readmeLinks };
