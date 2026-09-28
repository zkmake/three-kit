/**
 * Makes the site's icons and share images from each mark: `public/favicon.svg` for the kit and
 * `public/<library>/favicon.svg` for each library. Per mark: `apple-touch-icon.png` (180),
 * `favicon-32.png` and `og.png` (1200×630, the mark beside the name and a few lines); plus the
 * kit's `favicon.ico`.
 *
 * Needs ImageMagick 7 (`magick`) on the PATH and JetBrains Mono in ~/Library/Fonts. Run from the
 * app: `bun run icons`. The outputs are committed; this is how they were made.
 */
import { execFileSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";

const PUBLIC = new URL("../public/", import.meta.url).pathname;
const FONT = `${homedir()}/Library/Fonts/JetBrainsMono-Medium.ttf`;
const FONT_BOLD = `${homedir()}/Library/Fonts/JetBrainsMono-Bold.ttf`;
const HOST = "three-kit.pages.dev";

type Card = {
  /** Folder under public/, or "" for the kit. */
  dir: string;
  title: string;
  lines: [string, string];
  accent: string;
};

const CARDS: Card[] = [
  {
    dir: "",
    title: "three-kit",
    lines: ["dev tools and helpers", "for three.js"],
    accent: "meter · textures · cameras · audit · batch",
  },
  {
    dir: "three-meter",
    title: "three-meter",
    lines: ["FPS · CPU · GPU · draw calls", "for three.js, in a dockable HUD"],
    accent: "WebGL · WebGPU · vanilla · React Three Fiber",
  },
  {
    dir: "three-textures",
    title: "three-textures",
    lines: ["see · download · paint · swap", "three.js textures, live"],
    accent: "KTX2 too · vanilla · React Three Fiber",
  },
  {
    dir: "three-cameras",
    title: "three-cameras",
    lines: ["every camera · which are live", "three.js cameras, at a glance"],
    accent: "frustums · vanilla · React Three Fiber",
  },
  {
    dir: "three-audit",
    title: "three-audit",
    lines: ["z-fighting · NaN geometry · draws", "checks for three.js scenes"],
    accent: "unit tests · console · glTF CLI",
  },
  {
    dir: "three-batch",
    title: "three-batch",
    lines: ["fewer draw calls and triangles", "for three.js scenes"],
    accent: "cells · bakes · follow batches · pools",
  },
];

const magick = (args: string[]) => execFileSync("magick", args);

for (const card of CARDS) {
  const dir = `${PUBLIC}${card.dir ? `${card.dir}/` : ""}`;
  const svg = `${dir}favicon.svg`;
  const mark = `${tmpdir()}/three-kit-mark.png`;
  const url = card.dir ? `${HOST}/${card.dir}` : HOST;

  const icon = (density: string, size: string, out: string) =>
    magick(["-background", "none", "-density", density, svg, "-resize", size, "-depth", "8", out]);

  icon("384", "180x180", `PNG32:${dir}apple-touch-icon.png`);
  icon("96", "32x32", `PNG32:${dir}favicon-32.png`);
  magick(["-background", "none", "-density", "1200", svg, "-resize", "250x250", mark]);
  magick([
    "-size",
    "1200x630",
    "xc:#0f1115",
    "(",
    mark,
    ")",
    "-geometry",
    "+84+190",
    "-composite",
    "-font",
    FONT_BOLD,
    "-fill",
    "#e6e8eb",
    "-pointsize",
    "74",
    "-annotate",
    "+400+262",
    card.title,
    "-font",
    FONT,
    "-fill",
    "#8b909a",
    "-pointsize",
    "32",
    "-annotate",
    "+402+338",
    card.lines[0],
    "-annotate",
    "+402+388",
    card.lines[1],
    "-fill",
    "#ffe27a",
    "-pointsize",
    "25",
    "-annotate",
    "+402+466",
    card.accent,
    "-fill",
    "#6b7079",
    "-pointsize",
    "22",
    "-annotate",
    "+402+530",
    `${url}  ·  by Zubin Khavarian`,
    "-depth",
    "8",
    `PNG32:${dir}og.png`,
  ]);
}

magick([
  "-background",
  "none",
  "-density",
  "96",
  `${PUBLIC}favicon.svg`,
  "-define",
  "icon:auto-resize=48,32,16",
  `${PUBLIC}favicon.ico`,
]);

// oxlint-disable-next-line no-console -- a script's report
console.log(`wrote icons and og.png for ${CARDS.map((card) => card.title).join(", ")}`);
