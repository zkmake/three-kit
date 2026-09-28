/**
 * The docs pages render each package's README, whose relative links are written for GitHub. This
 * points them where they resolve from the site: a sibling package (`../three-audit`) to its page
 * here, anything else in the repo to GitHub (images to the raw file). Anchors and absolute URLs
 * stay as they are.
 */
import type { SatteriProcessorOptions } from "@astrojs/markdown-satteri";

type Plugin = NonNullable<SatteriProcessorOptions["mdastPlugins"]>[number];

const REPO = "zkmake/three-kit";
const PACKAGE = /\/packages\/(three-[a-z]+)\/README\.md$/;
const SIBLING = /^\.\.\/(three-[a-z]+)\/?$/;

const rewrite = (url: string, pkg: string, raw: boolean) => {
  if (/^([a-z]+:|\/|#)/i.test(url)) {
    return url;
  }

  const sibling = SIBLING.exec(url);

  if (sibling) {
    return `/${sibling[1]}/`;
  }

  const path = new URL(url, `https://x/packages/${pkg}/`).pathname.slice(1);

  return raw
    ? `https://raw.githubusercontent.com/${REPO}/main/${path}`
    : `https://github.com/${REPO}/blob/main/${path}`;
};

/** Runs on a package README only; other markdown gets no plugin. */
const readmeLinks: Plugin = ({ fileURL }) => {
  const pkg = PACKAGE.exec(fileURL?.pathname ?? "")?.[1];

  if (!pkg) {
    return null;
  }

  return {
    name: "readme-links",
    link: (node, ctx) => {
      ctx.setProperty(node, "url", rewrite(node.url, pkg, false));
    },
    image: (node, ctx) => {
      ctx.setProperty(node, "url", rewrite(node.url, pkg, true));
    },
  };
};

export { readmeLinks };
