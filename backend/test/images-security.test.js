import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { File } from "node:buffer";

import express from "express";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blog-images-security-"));
const imagesDir = path.join(tempRoot, "images");

process.env.ADMIN_BEARER_TOKEN = process.env.ADMIN_BEARER_TOKEN || "images-security-admin";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
process.env.APP_ENV = process.env.APP_ENV || "test";
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || "gpt-4.1-mini";
process.env.CONTENT_IMAGES_DIR = imagesDir;

const { default: imagesRouter } = await import("../src/routes/images.js");

after(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

function createApp() {
  const app = express();
  app.use("/api/v1/images", imagesRouter);
  app.use((err, _req, res, _next) => {
    res.status(err?.status || 500).json({
      ok: false,
      error: err?.message || "Unhandled test error",
    });
  });
  return app;
}

async function withServer(callback) {
  const server = http.createServer(createApp());

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

test("backend image upload rejects SVG files", async () => {
  await withServer(async (baseUrl) => {
    const formData = new FormData();
    formData.append(
      "files",
      new File(["<svg><script>alert(1)</script></svg>"], "bad.svg", {
        type: "image/svg+xml",
      }),
    );

    const response = await fetch(`${baseUrl}/api/v1/images/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_BEARER_TOKEN}`,
      },
      body: formData,
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.match(payload.error, /Unsupported file type: \.svg/);
  });
});

test("backend chat image upload rejects SVG content", async () => {
  await withServer(async (baseUrl) => {
    const formData = new FormData();
    formData.append(
      "file",
      new File(["<svg><script>alert(1)</script></svg>"], "bad.svg", {
        type: "image/svg+xml",
      }),
    );

    const response = await fetch(`${baseUrl}/api/v1/images/chat-upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_BEARER_TOKEN}`,
      },
      body: formData,
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.deepEqual(payload, {
      ok: false,
      error: "Unsupported content type: image/svg+xml",
    });
  });
});
