import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  await fs.readFile(path.join(root, "public-config.json"), "utf8"),
);
const upstream = new URL(config.apiBaseUrl);
const publicRoot = path.resolve(root, "../../frontend/public");
const port = Number(process.env.READER_PORT || 4320);
const mime = {
  ".html": "text/html;charset=utf-8",
  ".js": "application/javascript;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".json": "application/json;charset=utf-8",
  ".md": "text/markdown;charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      const target = new URL(url.pathname + url.search, upstream);
      const controller = new AbortController();
      req.on("aborted", () => controller.abort());
      req.on("error", () => controller.abort());
      res.on("close", () => {
        if (!res.writableEnded) controller.abort();
      });
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (
          [
            "host",
            "connection",
            "origin",
            "referer",
            "content-length",
            "accept-encoding",
          ].includes(name) ||
          value === undefined
        )
          continue;
        headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
      const request = {
        method: req.method,
        headers,
        signal: controller.signal,
      };
      if (!["GET", "HEAD"].includes(req.method)) {
        request.body = Readable.toWeb(req);
        request.duplex = "half";
      }
      const response = await fetch(target, request);
      res.statusCode = response.status;
      response.headers.forEach((value, name) => {
        if (
          ![
            "connection",
            "transfer-encoding",
            "content-encoding",
            "content-length",
          ].includes(name)
        )
          res.setHeader(name, value);
      });
      res.setHeader("Cache-Control", "no-store");
      if (response.body) await pipeline(Readable.fromWeb(response.body), res);
      else res.end();
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes("\0")) {
      res.writeHead(400);
      res.end();
      return;
    }
    let data, file;
    const relative =
      pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    for (const base of [root, publicRoot]) {
      const candidate = path.resolve(base, relative);
      if (!candidate.startsWith(base + path.sep)) continue;
      try {
        const stat = await fs.stat(candidate);
        if (!stat.isFile()) continue;
        data = await fs.readFile(candidate);
        file = candidate;
        break;
      } catch {}
    }
    if (!data) {
      res.writeHead(404, { "Content-Type": "text/plain;charset=utf-8" });
      res.end("파일을 찾을 수 없습니다.");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(data);
  } catch (error) {
    if (res.destroyed) return;
    if (!res.headersSent)
      res.writeHead(502, { "Content-Type": "application/json" });
    if (!res.writableEnded)
      res.end(
        JSON.stringify({
          ok: false,
          error: "UPSTREAM_UNAVAILABLE",
          message: "AI 서비스에 연결하지 못했습니다. 다시 시도해 주세요.",
        }),
      );
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Actual article previews: http://localhost:${port} (API upstream: ${upstream.origin})`,
  ),
);
