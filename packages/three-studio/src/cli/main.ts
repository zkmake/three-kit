/**
 * `three-studio serve | diff | montage`: receive the page's shots, and compare them. `diff` exits 1
 * past `--max`, so a stored baseline can gate CI.
 */
/* oxlint-disable no-console -- a CLI's output is the console */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { SHOT_PORT } from "../core/capture.ts";
import { diffImages, montage } from "../node/compare.ts";
import { decodePng, encodePng } from "../node/png.ts";
import { startShotServer } from "../node/serve.ts";

const HELP = `Usage: three-studio <command> [options]

Commands:
  serve <folder>                  Receive saveShot() PNGs from the page and write them inside
                                  <folder>. Local only. Runs until stopped.
    --port <n>                    Default ${SHOT_PORT}, the port saveShot() posts to

  diff <before.png> <after.png>   Count the pixels that differ. Prints "<n> px differ (<share>%)".
    --fuzz <percent>              How far a channel may move and still match (default 3)
    --max <percent>               Exit 1 when more than this share differs (default: never)
    --out <mask.png>              Write the differing pixels in white over a dimmed before
    --json                        Print the result as JSON

  montage <out.png> <before> <after> [<before> <after>…]
                                  One row per pair, before left and after right, rows stacked.
    --scale <n>                   Scale of the result (default 0.5)
    --gap <px>                    Space between images, before scaling (default 8)

  -h, --help                      Show this help
  -v, --version                   Show the version

Exits 2 on bad arguments or a file it can't read.`;

/** This package's version: its package.json is the nearest one up from here (`src/cli` or `dist`). */
const version = () => {
  for (let up = "../"; up.length <= 12; up += "../") {
    try {
      const pkg = JSON.parse(
        readFileSync(new URL(`${up}package.json`, import.meta.url), "utf8"),
      ) as {
        name?: string;
        version: string;
      };

      if (pkg.name === "@zkmake/three-studio") {
        return pkg.version;
      }
    } catch {
      // Not here; one more up.
    }
  }

  return "unknown";
};

const readPng = (file: string) => decodePng(readFileSync(file));

const percent = (text: string | undefined, name: string, fallback?: number) => {
  if (text === undefined) {
    return fallback;
  }

  const value = Number(text);

  if (!(value >= 0 && value <= 100)) {
    throw new Error(`--${name} must be a percentage from 0 to 100`);
  }

  return value / 100;
};

export type MainOptions = {
  /** Resolves when `serve` should stop. Default: SIGINT or SIGTERM. */
  stop?: Promise<unknown> | undefined;
};

export const main = async (argv: string[], options: MainOptions = {}): Promise<number> => {
  let parsed;

  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        port: { type: "string" },
        fuzz: { type: "string" },
        max: { type: "string" },
        out: { type: "string" },
        json: { type: "boolean", default: false },
        scale: { type: "string" },
        gap: { type: "string" },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", short: "v", default: false },
      },
    });
  } catch (error) {
    console.error(`three-studio: ${(error as Error).message}\n\n${HELP}`);

    return 2;
  }

  const { values, positionals } = parsed;
  const [command, ...files] = positionals;

  if (values.help) {
    console.log(HELP);

    return 0;
  }

  if (values.version) {
    console.log(version());

    return 0;
  }

  try {
    if (command === "serve" && files.length === 1) {
      const port = values.port === undefined ? SHOT_PORT : Number(values.port);

      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error("--port must be a port number");
      }

      const shots = await startShotServer(files[0] as string, { port, log: console.log }).catch(
        (error: NodeJS.ErrnoException) => {
          throw error.code === "EADDRINUSE"
            ? new Error(
                `port ${port} is taken, by another receiver or app: pass --port <free port>, and open the page with &shots=<that port>`,
              )
            : error;
        },
      );

      console.log(`three-studio: writing .png files inside ${shots.root} from ${shots.url}`);
      await (options.stop ??
        new Promise((stop) => {
          process.once("SIGINT", stop);
          process.once("SIGTERM", stop);
        }));
      await shots.close();

      return 0;
    }

    if (command === "diff" && files.length === 2) {
      const fuzz = percent(values.fuzz, "fuzz", 0.03);
      const max = percent(values.max, "max");
      const result = diffImages(readPng(files[0] as string), readPng(files[1] as string), { fuzz });
      const over = max !== undefined && result.share > max;

      if (values.out) {
        writeFileSync(values.out, encodePng(result.mask));
      }

      if (values.json) {
        console.log(
          JSON.stringify({ pixels: result.pixels, total: result.total, share: result.share, over }),
        );
      } else {
        console.log(`${result.pixels} px differ (${(result.share * 100).toFixed(4)}%)`);
      }

      return over ? 1 : 0;
    }

    if (command === "montage" && files.length >= 3 && files.length % 2 === 1) {
      const [out, ...shots] = files as [string, ...string[]];
      const scale = values.scale === undefined ? 0.5 : Number(values.scale);
      const gap = values.gap === undefined ? 8 : Number(values.gap);

      if (!(scale > 0) || !(gap >= 0)) {
        throw new Error("--scale must be above 0 and --gap 0 or more");
      }

      const pairs: [ReturnType<typeof readPng>, ReturnType<typeof readPng>][] = [];

      for (let i = 0; i < shots.length; i += 2) {
        pairs.push([readPng(shots[i] as string), readPng(shots[i + 1] as string)]);
      }

      writeFileSync(out, encodePng(montage(pairs, { scale, gap })));
      console.log(out);

      return 0;
    }
  } catch (error) {
    console.error(`three-studio: ${(error as Error).message}`);

    return 2;
  }

  console.error(HELP);

  return 2;
};
