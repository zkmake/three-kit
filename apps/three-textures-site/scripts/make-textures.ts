import { encodeToKTX2 } from "ktx2-encoder";
/**
 * Makes the site's textures, all original: `public/textures/crate.webp` (an image texture with a
 * source file to download) and `public/textures/stickers.ktx2` (a 2×2 sticker atlas, Basis ETC1S
 * with mipmaps, for the compressed swap). Each tile says TOP along its top edge, so a readback or
 * a swap that lands upside down shows at a glance.
 *
 * Needs ImageMagick 7 (`magick`) on the PATH. Run from the app: `bun run textures`. The outputs are
 * committed; this is how they were made.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = new URL("../public/textures/", import.meta.url).pathname;
/** The atlas as drawn, before encoding: kept as source art, not served. */
const ART = new URL("../art/", import.meta.url).pathname;
const FONT = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf";
const SIZE = 1024;
const HALF = SIZE / 2;

const magick = (args: string[]) => execFileSync("magick", args, { maxBuffer: 64 * 1024 * 1024 });

mkdirSync(OUT, { recursive: true });
mkdirSync(ART, { recursive: true });

// Four sticker tiles. Shapes are drawn in each tile's own frame via `translate`.
const tiles = [
  { at: [0, 0], fill: "#8ecae6", ink: "#023047", name: "sun", shape: "circle 256,280 256,160" },
  {
    at: [HALF, 0],
    fill: "#ffb4c6",
    ink: "#6d213c",
    name: "heart",
    shape:
      "path 'M 256,390 C 120,300 110,190 180,165 C 225,150 250,180 256,205 C 262,180 287,150 332,165 C 402,190 392,300 256,390 Z'",
  },
  {
    at: [0, HALF],
    fill: "#a7d676",
    ink: "#1b4332",
    name: "tree",
    shape: "polygon 256,130 370,330 142,330",
  },
  {
    at: [HALF, HALF],
    fill: "#ffd166",
    ink: "#7f4f24",
    name: "star",
    shape:
      "polygon 256,125 290,225 395,228 312,290 342,390 256,330 170,390 200,290 117,228 222,225",
  },
];

const atlasArgs = ["-size", `${SIZE}x${SIZE}`, "xc:#fdfaf3"];

for (const tile of tiles) {
  const [x, y] = tile.at as [number, number];

  atlasArgs.push(
    "-fill",
    tile.fill,
    "-draw",
    `roundrectangle ${x + 12},${y + 12} ${x + HALF - 12},${y + HALF - 12} 36,36`,
    "-fill",
    "#ffffffcc",
    "-draw",
    `translate ${x},${y} ${tile.shape}`,
    "-fill",
    tile.ink,
    "-font",
    FONT,
    "-pointsize",
    "40",
    "-annotate",
    `+${x + 206}+${y + 76}`,
    "TOP",
    "-pointsize",
    "54",
    "-annotate",
    `+${x + 256 - tile.name.length * 15}+${y + 460}`,
    tile.name,
  );
}

atlasArgs.push(`${ART}stickers.png`);
magick(atlasArgs);

// Raw RGBA for the encoder, which takes a decoder in Node.
const raw = magick([`${ART}stickers.png`, "-depth", "8", "rgba:-"]);
const ktx2 = await encodeToKTX2(new Uint8Array(readFileSync(`${ART}stickers.png`)), {
  isUASTC: false,
  generateMipmap: true,
  isSetKTX2SRGBTransferFunc: true,
  qualityLevel: 200,
  imageDecoder: async () => ({ data: new Uint8Array(raw), width: SIZE, height: SIZE }),
});

writeFileSync(`${OUT}stickers.ktx2`, ktx2);

// A crate: planks with grain, a frame and a cross brace, and a stencil to paint over.
magick([
  "-size",
  "512x512",
  "-seed",
  "7",
  "xc:#a8743f",
  "-attenuate",
  "0.9",
  "+noise",
  "Multiplicative",
  "-motion-blur",
  "0x28+0",
  "-colorspace",
  "Gray",
  "-level",
  "20%,90%",
  "+level-colors",
  "#7a4c24,#d19a5e",
  "-fill",
  "#5b3a1e",
  "-draw",
  "rectangle 0,126 511,131",
  "-draw",
  "rectangle 0,254 511,259",
  "-draw",
  "rectangle 0,382 511,387",
  "-fill",
  "none",
  "-stroke",
  "#4a2f17",
  "-strokewidth",
  "36",
  "-draw",
  "rectangle 18,18 493,493",
  "-strokewidth",
  "30",
  "-draw",
  "line 40,40 472,472",
  "-stroke",
  "none",
  "-fill",
  "#2b1a0dcc",
  "-font",
  FONT,
  "-pointsize",
  "58",
  "-gravity",
  "center",
  "-annotate",
  "+0+0",
  "PAINT ME",
  "-quality",
  "86",
  `${OUT}crate.webp`,
]);

// oxlint-disable-next-line no-console -- a script's report
console.log(`wrote ${OUT}crate.webp, ${OUT}stickers.ktx2, ${ART}stickers.png`);
