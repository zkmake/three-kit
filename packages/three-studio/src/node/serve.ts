/**
 * The shot receiver: `saveShot(path)` in the page POSTs a PNG here and it lands on disk. Local
 * only, `.png` only, and only inside the folder it was started on.
 */
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import { SHOT_PORT } from "../core/capture.ts";

export type ShotServerOptions = {
  /** Default 8787, the port `saveShot` posts to. 0 picks a free one. */
  port?: number | undefined;
  /** Default 127.0.0.1. */
  host?: string | undefined;
  /** Each file written, with its size. Default: nothing. */
  log?: ((line: string) => void) | undefined;
};

export type ShotServer = {
  server: Server;
  /** `http://<host>:<port>`, to pass to `saveShot`'s `endpoint`. */
  url: string;
  /** The folder files are written in, resolved. */
  root: string;
  close: () => Promise<void>;
};

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

const cors = (response: ServerResponse) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Chrome's Private Network Access: a page on a public origin may post to localhost.
  response.setHeader("Access-Control-Allow-Private-Network", "true");
};

const reply = (response: ServerResponse, status: number, text: string) => {
  cors(response);
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(text);
};

const readBody = (request: IncomingMessage) =>
  new Promise<Buffer>((done, fail) => {
    const parts: Buffer[] = [];

    request.on("data", (part: Buffer) => parts.push(part));
    request.on("end", () => done(Buffer.concat(parts)));
    request.on("error", fail);
  });

/**
 * Starts the receiver on `root`. `POST /shot?path=<file>.png` with the PNG as the body writes it;
 * the path may be absolute or relative to `root`, and must stay inside it. Replies with the path
 * written.
 */
export function startShotServer(
  root: string,
  options: ShotServerOptions = {},
): Promise<ShotServer> {
  mkdirSync(root, { recursive: true });

  const base = realpathSync(root);
  const host = options.host ?? "127.0.0.1";

  const server = createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      cors(response);
      response.writeHead(204);
      response.end();

      return;
    }

    // Read the body before any refusal: replying with it unread resets the connection, and the
    // browser then reports "Failed to fetch" instead of the reason.
    const body = await readBody(request);
    const url = new URL(request.url ?? "/", "http://localhost");
    const path = url.searchParams.get("path") ?? "";

    if (request.method !== "POST" || url.pathname !== "/shot" || !path.endsWith(".png")) {
      reply(response, 400, "need POST /shot?path=<file>.png with the PNG as the body");

      return;
    }

    const target = resolve(base, path);
    const inside = relative(base, target);

    if (inside.startsWith("..") || isAbsolute(inside)) {
      reply(response, 403, `path must be inside ${base}`);

      return;
    }

    if (body.length < 8 || PNG_MAGIC.some((byte, index) => body[index] !== byte)) {
      reply(response, 415, "the body isn't a PNG");

      return;
    }

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
    options.log?.(`${target}  ${body.length.toLocaleString("en-US")} bytes`);
    reply(response, 200, target);
  });

  return new Promise((done, fail) => {
    server.once("error", fail);
    server.listen(options.port ?? SHOT_PORT, host, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : options.port;

      done({
        server,
        url: `http://${host}:${port}`,
        root: base,
        close: () => new Promise((closed) => server.close(() => closed())),
      });
    });
  });
}
