/**
 * Makes the share images (`og.png`, 1200×630) for the kit and each library, and the landing
 * hero's poster (`hero.webp` and smaller `hero-600`/`hero-400`, the scene's still for before it
 * draws or without WebGL). A share
 * image has the mark, the name, what it does and a few tags on the left, and a picture of it at
 * work on the right (the landing page's live scene for the kit, a frame of the demo for a library
 * that has one, the landing card's drawing for the others). Each card is laid out as HTML and
 * screenshotted, so it uses the site's own fonts and colours.
 *
 * Needs `agent-browser`, ImageMagick and `cwebp` on the PATH and JetBrains Mono in ~/Library/Fonts. The pictures come from
 * the deployed site; `SITE=http://localhost:3020/three-kit bun run og` takes them from `bun dev`
 * instead. Run from the app: `bun run og`. The outputs are committed; this is how they were made.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { LIBRARIES, type LibraryName } from "../src/libraries.ts";

const PUBLIC = new URL("../public/", import.meta.url).pathname;
const FONTS = `${homedir()}/Library/Fonts`;
const SITE = (process.env.SITE ?? "https://zkmake.github.io/three-kit").replace(/\/$/, "");
const HOST = "zkmake.github.io/three-kit";

type Card = {
  /** Folder under public/, or "" for the kit. */
  dir: "" | LibraryName;
  /** The big line, as HTML. */
  title: string;
  /** Under the title, as HTML. */
  lede: string;
  tags: string[];
};

const CARDS: Card[] = [
  {
    dir: "",
    title: "three-kit",
    lede: 'Find and fix what makes a three.js scene <b class="slow">slow</b> or <b class="broken">broken</b>.',
    tags: ["meter", "textures", "cameras", "audit", "batch"],
  },
  {
    dir: "three-meter",
    title: "three-meter",
    lede: "FPS, CPU and GPU time, draw calls and triangles, live in a dockable HUD.",
    tags: ["WebGL", "WebGPU", "vanilla", "R3F"],
  },
  {
    dir: "three-textures",
    title: "three-textures",
    lede: "See, download, paint and swap the textures in a running scene.",
    tags: ["KTX2", "A/B", "live-link", "vanilla", "R3F"],
  },
  {
    dir: "three-cameras",
    title: "three-cameras",
    lede: "Every camera in the scene, which ones are drawing, and their settings live.",
    tags: ["frustums", "keyframes", "vanilla", "R3F"],
  },
  {
    dir: "three-audit",
    title: "three-audit",
    lede: "Catch z-fighting, NaN geometry and draw-call blowups in tests and CI.",
    tags: ["unit tests", "console", "glTF CLI"],
  },
  {
    dir: "three-batch",
    title: "three-batch",
    lede: "Fewer draw calls and triangles: culling cells, bakes, instance pools.",
    tags: ["bakes", "cells", "pools", "far copies"],
  },
];

const browser = (...args: string[]) => execFileSync("agent-browser", args, { stdio: "pipe" });
const work = mkdtempSync(join(tmpdir(), "three-kit-og-"));

/** Hides the site's chrome and any dev panel that isn't `library`'s (the demo pages). */
const hideChrome = (library: string) => `
  const style = document.createElement("style");
  style.textContent = ".bar, .install, .inset-frame, .hero__demo-link { display: none !important; }";
  document.head.append(style);
  for (const panel of document.querySelectorAll("#stage ~ .perf-hud, body > .perf-hud")) {
    const brand = panel.querySelector(".perf-hud__brand-name")?.textContent;
    if (brand !== ${JSON.stringify(library)}) panel.style.display = "none";
  }
`;

/**
 * Saves one element of the open page, `inset` CSS pixels in from its edges (clear of rounded
 * corners). Crops a viewport shot: agent-browser's element shots come back blank on a scrolled
 * page at 2x.
 */
const shootElement = (selector: string, out: string, inset = 0) => {
  const box = JSON.parse(
    JSON.parse(
      browser(
        "eval",
        `JSON.stringify((({ x, y, width, height }) => ({ x, y, width, height }))(document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect()))`,
      ).toString(),
    ),
  ) as { x: number; y: number; width: number; height: number };
  const scale = 2;
  const whole = `${out}.viewport.png`;
  const size = (value: number) => Math.round((value - inset * 2) * scale);
  const at = (value: number) => Math.round((value + inset) * scale);

  browser("screenshot", whole);
  execFileSync("magick", [
    whole,
    "-crop",
    `${size(box.width)}x${size(box.height)}+${at(box.x)}+${at(box.y)}`,
    "+repage",
    out,
  ]);
};

// Pictures. Reduced motion holds the landing page still: its scene on one frame, its cards in
// place without their scroll-in.
const picture = (dir: Card["dir"]) => join(work, `${dir || "kit"}.png`);

browser("set", "media", "dark", "reduced-motion");
browser("set", "viewport", "1280", "900", "2");
// `?live-hero`: headless Chrome draws WebGL in software, where the page keeps its poster.
browser("open", `${SITE}/?live-hero`);
browser("wait", "5000");
browser("eval", hideChrome(""));
// The hero's poster (public/hero.webp): the canvas alone, transparent around the lattice, so it
// sits on either theme. Read in a frame after three has drawn, before the buffer is cleared.
const posterPng = join(work, "hero-poster.png");
const dataUrl = JSON.parse(
  browser(
    "eval",
    `new Promise((done) => requestAnimationFrame(() => done(document.querySelector(".hero__canvas").toDataURL("image/png"))))`,
  ).toString(),
) as string;

writeFileSync(posterPng, Buffer.from(dataUrl.split(",")[1]!, "base64"));
// 800 for desktop and dense screens; 400 and 600 for the phone sizes the page's srcset offers.
for (const [size, name] of [
  [800, "hero.webp"],
  [600, "hero-600.webp"],
  [400, "hero-400.webp"],
] as const) {
  execFileSync("cwebp", [
    "-quiet",
    "-q",
    "82",
    "-alpha_q",
    "90",
    "-resize",
    String(size),
    String(size),
    posterPng,
    "-o",
    `${PUBLIC}${name}`,
  ]);
}

// An opaque ground under the scene's transparent canvas, the page's own.
browser("eval", `document.querySelector("[data-hero-scene]").style.background = "#0f1115"`);
browser("wait", "300");
shootElement("[data-hero-scene]", picture(""));

for (const library of LIBRARIES.filter(({ demo }) => !demo)) {
  const card = `.card:nth-child(${LIBRARIES.indexOf(library) + 1})`;

  browser("scrollintoview", card);
  browser("wait", "300");
  shootElement(`${card} .card__media`, picture(library.name), 8);
}

/** A demo whose scene sits small in a 1280×720 frame gets a narrower window. */
const DEMO_WIDTH: Partial<Record<LibraryName, number>> = { "three-textures": 1024 };

browser("set", "media", "dark");

for (const library of LIBRARIES.filter(({ demo }) => demo)) {
  const width = DEMO_WIDTH[library.name] ?? 1280;

  browser("set", "viewport", String(width), String(Math.round((width * 9) / 16)), "1");
  browser("open", `${SITE}/${library.name}/`);
  browser("wait", "3500");
  browser("eval", hideChrome(library.name));
  browser("wait", "300");
  browser("screenshot", picture(library.name));
}

const page = (card: Card) => `<!doctype html>
<meta charset="utf-8" />
<style>
  @font-face { font-family: JBM; font-weight: 400; src: url("file://${FONTS}/JetBrainsMono-Regular.ttf"); }
  @font-face { font-family: JBM; font-weight: 500; src: url("file://${FONTS}/JetBrainsMono-Medium.ttf"); }
  @font-face { font-family: JBM; font-weight: 800; src: url("file://${FONTS}/JetBrainsMono-ExtraBold.ttf"); }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    position: relative; width: 1200px; height: 630px; overflow: hidden;
    background:
      radial-gradient(circle at 78% 50%, rgba(255, 226, 122, 0.13), transparent 46%),
      #0f1115;
    color: #e6e8eb; font-family: JBM, monospace;
  }
  /* A viewport's floor grid, fading toward the copy. */
  body::before {
    content: ""; position: absolute; inset: 0;
    background:
      linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px) 0 0 / 40px 40px,
      linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px) 0 0 / 40px 40px;
    mask-image: linear-gradient(90deg, transparent 20%, #000 75%);
  }
  .copy {
    position: absolute; left: 72px; top: 64px; bottom: 60px; width: 560px;
    display: flex; flex-direction: column;
  }
  .kit { display: flex; align-items: center; gap: 14px; font-size: 24px; font-weight: 500; color: #8b909a; }
  .kit img { width: 48px; height: 48px; }
  .kit b { color: #e6e8eb; font-weight: 500; }
  h1 { margin: auto 0 0; font-size: 62px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
  .lede { margin: 20px 0 0; font-size: 27px; line-height: 1.38; color: #a3a8b1; text-wrap: balance; }
  .kit-card h1 { display: none; }
  .kit-card .lede { margin: auto 0 0; font-size: 46px; font-weight: 800; line-height: 1.06; letter-spacing: -0.04em; color: #e6e8eb; }
  .slow { color: #ffe27a; font-weight: inherit; }
  .broken {
    font-weight: inherit; color: transparent; -webkit-background-clip: text; background-clip: text;
    background: repeating-linear-gradient(-58deg, #e6e8eb 0 0.07em, #ff6b9a 0.07em 0.115em,
      #e6e8eb 0.115em 0.17em, #6ba6ff 0.17em 0.205em);
    -webkit-background-clip: text; background-clip: text;
  }
  .tags { display: flex; flex-wrap: wrap; gap: 10px; margin: 28px 0 0; padding: 0; list-style: none; }
  .tags li {
    padding: 6px 14px; border: 1.5px solid rgba(255, 226, 122, 0.4); border-radius: 999px;
    color: #ffe27a; font-size: 19px; font-weight: 500;
  }
  .url { margin-top: auto; font-size: 19px; color: #6b7079; }
  .picture {
    position: absolute; right: 56px; top: 50%; translate: 0 -50%;
    width: 500px; aspect-ratio: 16 / 9; overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 18px; background: #0c0d11;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55), 0 0 0 6px rgba(255, 255, 255, 0.02);
  }
  .picture img { display: block; width: 100%; height: 100%; object-fit: cover; }
  /* The kit's scene is square. */
  .kit-card .picture { width: 452px; aspect-ratio: 1; background: #0f1115; }
</style>
<body class="${card.dir ? "lib-card" : "kit-card"}">
  <div class="copy">
    <div class="kit">
      <img src="file://${PUBLIC}${card.dir ? `${card.dir}/` : ""}favicon.svg" alt="" />
      ${card.dir ? `three-kit /&nbsp;<b>${card.dir}</b>` : "<b>three-kit</b>"}
    </div>
    <h1>${card.title}</h1>
    <p class="lede">${card.lede}</p>
    <ul class="tags">${card.tags.map((tag) => `<li>${tag}</li>`).join("")}</ul>
    <div class="url">${card.dir ? `${HOST}/${card.dir}` : HOST}</div>
  </div>
  <div class="picture"><img src="file://${picture(card.dir)}" alt="" /></div>
</body>`;

browser("set", "viewport", "1200", "630", "1");

for (const card of CARDS) {
  const html = join(work, `${card.dir || "kit"}.html`);
  const shot = join(work, `${card.dir || "kit"}-og.png`);

  writeFileSync(html, page(card));
  browser("open", `file://${html}`);
  browser("wait", "400");
  browser("screenshot", shot);
  // 8-bit, no alpha: smaller and what every share preview expects.
  execFileSync("magick", [
    shot,
    "-alpha",
    "off",
    "-depth",
    "8",
    `PNG24:${PUBLIC}${card.dir ? `${card.dir}/` : ""}og.png`,
  ]);
}

rmSync(work, { recursive: true, force: true });

// oxlint-disable-next-line no-console -- a script's report
console.log(`wrote hero.webp, and og.png for ${CARDS.map((card) => card.title).join(", ")}`);
