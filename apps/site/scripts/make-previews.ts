/**
 * Records the landing cards' clips from the live demos: `public/<library>/preview.mp4` (a few
 * seconds, 640×360, muted, loops) and `preview.webp` (its poster) for each library with a demo.
 * The site's chrome and every dev panel are hidden, so all three clips show just their scene, in
 * one style with the landing cards' drawings; the card's chip says what the package adds.
 *
 * Needs `agent-browser`, `ffmpeg` (with libx264) and `cwebp` on the PATH. Run from the app after a
 * deploy: `bun run previews`. The outputs are committed; this is how they were made.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LIBRARIES } from "../src/libraries.ts";

const PUBLIC = new URL("../public/", import.meta.url).pathname;
const SITE = "https://zkmake.github.io/three-kit";
const SECONDS = 5;

/** Hides the site's chrome and every dev panel. */
const HIDE_CHROME = `
  const style = document.createElement("style");
  style.textContent = ".bar, .install, .inset-frame, .perf-hud, .ttx-preview { display: none !important; }";
  document.head.append(style);
`;

/**
 * Zoom in on a scene that leaves its frame mostly empty: the crop's width as a share of the frame,
 * and its centre. Recorded at 2x, so a half-width crop still has the pixels for 640×360.
 */
const CROP: Partial<Record<string, { size: number; x: number; y: number }>> = {
  "three-textures": { size: 0.62, x: 0.39, y: 0.5 },
};

const browser = (...args: string[]) => execFileSync("agent-browser", args, { stdio: "pipe" });
const work = mkdtempSync(join(tmpdir(), "three-kit-previews-"));

browser("set", "media", "dark");

for (const { name, demo } of LIBRARIES) {
  if (!demo) {
    continue;
  }

  const raw = join(work, `${name}.webm`);
  browser("open", `${SITE}/${name}/`);
  browser("set", "viewport", "1280", "720", "2");
  browser("reload");
  browser("wait", "3000");
  browser("eval", HIDE_CHROME);
  browser("wait", "500");
  browser("record", "start", raw);
  browser("wait", String(SECONDS * 1000 + 500));
  browser("record", "stop");

  const crop = CROP[name];
  const zoom = crop
    ? `crop=iw*${crop.size}:ih*${crop.size}:iw*${crop.x - crop.size / 2}:ih*${crop.y - crop.size / 2},`
    : "";

  // Skip the first half second (the recorder settling); H.264 for every browser, no audio.
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-ss",
    "0.5",
    "-t",
    String(SECONDS),
    "-i",
    raw,
    "-vf",
    `${zoom}scale=640:360:flags=lanczos,fps=30`,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "30",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    `${PUBLIC}${name}/preview.mp4`,
  ]);
  const poster = join(work, `${name}.png`);

  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-ss",
    "0.5",
    "-i",
    raw,
    "-frames:v",
    "1",
    "-vf",
    `${zoom}scale=640:360:flags=lanczos`,
    poster,
  ]);
  execFileSync("cwebp", ["-quiet", "-q", "78", poster, "-o", `${PUBLIC}${name}/preview.webp`]);
  // oxlint-disable-next-line no-console -- a script's report
  console.log(`${name}: preview.mp4, preview.webp`);
}

rmSync(work, { recursive: true, force: true });
