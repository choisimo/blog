import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import express from "express";

process.env.JWT_SECRET = process.env.JWT_SECRET || "translation-proxy-test-secret";
process.env.WORKER_API_URL = process.env.WORKER_API_URL || "https://worker.example";
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || "gpt-4.1-mini";
process.env.APP_ENV = process.env.APP_ENV || "test";

const [{ default: translateRouter }, { signJwt }] = await Promise.all([
  import("../src/routes/translate.js"),
  import("../src/lib/jwt.js"),
]);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", translateRouter);
  app.use((err, _req, res, _next) => {
    res.status(err?.status || 500).json({
      ok: false,
      error: err?.message || "Unhandled test error",
    });
  });
  return app;
}

async function withServer(t, callback) {
  const server = http.createServer(createApp());

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");

  return callback(`http://127.0.0.1:${address.port}`);
}

function installFetchStub(t, implementation) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const requestUrl = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    if (requestUrl.startsWith("http://127.0.0.1:")) {
      return originalFetch(url, init);
    }
    return implementation(url, init);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
}

function createUserToken() {
  return signJwt({
    sub: "user-1",
    role: "user",
    type: "access",
  });
}

function createAdminToken() {
  return signJwt({
    sub: "admin-1",
    role: "admin",
    type: "access",
    emailVerified: true,
  });
}

test("proxy passthrough for public GET relays worker response", async (t) => {
  const upstreamCalls = [];

  installFetchStub(t, async (url, init) => {
    upstreamCalls.push({ url, init });
    return new Response(JSON.stringify({ ok: true, data: { title: "Worker translation" } }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "retry-after": "3",
        "x-worker-test": "public-get",
      },
    });
  });

  await withServer(t, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/translate/2024/test-post/en`, {
      headers: {
        Accept: "application/json",
        "X-Request-Id": "req-public-1",
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("retry-after"), "3");
    assert.equal(response.headers.get("x-worker-test"), "public-get");
    assert.deepEqual(await response.json(), {
      ok: true,
      data: { title: "Worker translation" },
    });
  });

  assert.equal(upstreamCalls.length, 1);
  assert.equal(upstreamCalls[0].url, "https://worker.example/api/v1/translate/2024/test-post/en");
  assert.equal(upstreamCalls[0].init.method, "GET");
  assert.equal(upstreamCalls[0].init.body, undefined);
  assert.equal(upstreamCalls[0].init.headers.Accept, "application/json");
  assert.equal(upstreamCalls[0].init.headers["X-Request-Id"], "req-public-1");
});

test("proxy passthrough for async generate forwards POST body and relays acceptance response", async (t) => {
  const upstreamCalls = [];
  const userToken = createUserToken();

  installFetchStub(t, async (url, init) => {
    upstreamCalls.push({ url, init });
    return new Response(
      JSON.stringify({
        ok: true,
        data: null,
        job: { id: "job-1", status: "running" },
      }),
      {
        status: 202,
        headers: {
          "content-type": "application/json",
          location: "/api/v1/internal/posts/2024/test-post/translations/en/generate/status?jobId=job-1",
          "retry-after": "3",
          "x-translation-job-id": "job-1",
        },
      },
    );
  });

  await withServer(t, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/v1/internal/posts/2024/test-post/translations/en/generate?async=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ forceRefresh: true }),
      },
    );

    assert.equal(response.status, 202);
    assert.equal(response.headers.get("retry-after"), "3");
    assert.equal(response.headers.get("x-translation-job-id"), "job-1");
    assert.equal(
      response.headers.get("location"),
      "/api/v1/internal/posts/2024/test-post/translations/en/generate/status?jobId=job-1",
    );
    assert.deepEqual(await response.json(), {
      ok: true,
      data: null,
      job: { id: "job-1", status: "running" },
    });
  });

  assert.equal(upstreamCalls.length, 1);
  assert.equal(
    upstreamCalls[0].url,
    "https://worker.example/api/v1/internal/posts/2024/test-post/translations/en/generate",
  );
  assert.equal(upstreamCalls[0].init.method, "POST");
  assert.equal(upstreamCalls[0].init.headers.Authorization, `Bearer ${userToken}`);
  assert.equal(upstreamCalls[0].init.headers["Content-Type"], "application/json");
  assert.equal(upstreamCalls[0].init.body, JSON.stringify({ forceRefresh: true }));
});

test("delete proxy forwards DELETE and relays the worker response", async (t) => {
  const upstreamCalls = [];
  const adminToken = createAdminToken();

  installFetchStub(t, async (url, init) => {
    upstreamCalls.push({ url, init });
    return new Response(JSON.stringify({ ok: true, data: { deleted: true } }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-worker-test": "delete",
        "content-length": "999",
      },
    });
  });

  await withServer(t, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/v1/internal/posts/2024/test-post/translations/en`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-worker-test"), "delete");
    assert.notEqual(response.headers.get("content-length"), "999");
    assert.deepEqual(await response.json(), {
      ok: true,
      data: { deleted: true },
    });
  });

  assert.equal(upstreamCalls.length, 1);
  assert.equal(
    upstreamCalls[0].url,
    "https://worker.example/api/v1/internal/posts/2024/test-post/translations/en",
  );
  assert.equal(upstreamCalls[0].init.method, "DELETE");
  assert.equal(upstreamCalls[0].init.headers.Authorization, `Bearer ${adminToken}`);
  assert.equal(upstreamCalls[0].init.body, "{}");
});
