import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import express from "express";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blog-posts-security-"));
const postsDir = path.join(tempRoot, "posts");
const publicDir = path.join(tempRoot, "public");

process.env.JWT_SECRET = process.env.JWT_SECRET || "posts-security-test-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
process.env.APP_ENV = process.env.APP_ENV || "test";
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || "gpt-4.1-mini";
process.env.CONTENT_POSTS_DIR = postsDir;
process.env.CONTENT_PUBLIC_DIR = publicDir;

await fs.mkdir(path.join(postsDir, "2026"), { recursive: true });
await fs.mkdir(publicDir, { recursive: true });
await fs.writeFile(
  path.join(postsDir, "2026", "public-post.md"),
  `---
title: Public Post
published: true
date: 2026-01-01
---

Public body
`,
);
await fs.writeFile(
  path.join(postsDir, "2026", "draft-post.md"),
  `---
title: Draft Post
published: false
date: 2026-01-02
---

Draft body
`,
);

const [{ default: postsRouter }, { signJwt }, { closeRedis }] = await Promise.all([
  import("../src/routes/posts.js"),
  import("../src/lib/jwt.js"),
  import("../src/lib/redis-client.js"),
]);

after(async () => {
  await closeRedis();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/posts", postsRouter);
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

function createAdminToken() {
  return signJwt({
    sub: "admin-1",
    role: "admin",
    username: "Admin",
    email: "admin@example.com",
    emailVerified: true,
    type: "access",
  });
}

test("public post list never includes drafts by default", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/posts`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.deepEqual(
      payload.data.items.map((item) => item.slug).sort(),
      ["public-post"],
    );
  });
});

test("includeDrafts requires admin authorization", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/posts?includeDrafts=true`);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: "Admin authorization required",
    });
  });
});

test("admin post list can include drafts", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/posts?includeDrafts=true`, {
      headers: {
        Authorization: `Bearer ${createAdminToken()}`,
      },
    });
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.deepEqual(
      payload.data.items.map((item) => item.slug).sort(),
      ["draft-post", "public-post"],
    );
  });
});

test("public single-post lookup hides unpublished markdown", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/posts/2026/draft-post`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { ok: false, error: "Not found" });
  });
});

test("admin single-post lookup can read unpublished markdown", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/posts/2026/draft-post`, {
      headers: {
        Authorization: `Bearer ${createAdminToken()}`,
      },
    });
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.data.item.slug, "draft-post");
    assert.equal(payload.data.item.published, false);
    assert.match(payload.data.markdown, /Draft body/);
  });
});
