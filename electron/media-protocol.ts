import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { protocol } from "electron";
import type { FileProjectRepository } from "./storage";

/** Register before app readiness so media has streaming and secure-context browser behaviour. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: "corto-media", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);
}

/** Serve only imported opaque IDs, including bounded byte ranges for video seeking. */
export function handleMediaRequests(repository: FileProjectRepository): void {
  protocol.handle("corto-media", async request => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== "asset" || !["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 400 });
      const id = decodeURIComponent(url.pathname.slice(1));
      const asset = await repository.assetMetadata(id);
      const headers = new Headers({ "Content-Type": asset.mime, "Accept-Ranges": "bytes", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
      let start = 0;
      let end = asset.size - 1;
      const range = request.headers.get("range");
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416 });
        if (!match[1]) start = Math.max(0, asset.size - Number(match[2]));
        else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= asset.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${asset.size}` } });
        headers.set("Content-Range", `bytes ${start}-${end}/${asset.size}`);
      }
      headers.set("Content-Length", String(end - start + 1));
      const body = request.method === "HEAD" ? null : Readable.toWeb(createReadStream(repository.assetPath(id), { start, end })) as ReadableStream<Uint8Array>;
      return new Response(body, { status: range ? 206 : 200, headers });
    } catch { return new Response("Original media was not found", { status: 404 }); }
  });
}
