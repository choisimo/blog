import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import express from "express";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blog-chat-idem-"));
const migrationsDir = path.join(tempRoot, "migrations");
await fs.mkdir(migrationsDir, { recursive: true });

process.env.APP_ENV = process.env.APP_ENV || "test";
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || "gpt-4.1-mini";
process.env.OPEN_NOTEBOOK_ENABLED = "false";
process.env.SQLITE_PATH = path.join(tempRoot, "idempotency.sqlite");
process.env.SQLITE_MIGRATIONS_DIR = migrationsDir;
process.env.CHAT_RESPONSE_TIMEOUT_MS = "5000";
process.env.CHAT_IDEMPOTENCY_TTL_SECONDS = "3600";

const [{ default: chatRouter }, { aiService }, sessionService] = await Promise.all([
  import("../src/routes/chat.js"),
  import("../src/lib/ai-service.js"),
  import("../src/services/session.service.js"),
]);

after(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/chat", chatRouter);
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
    server.closeAllConnections?.();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");
  return callback(`http://127.0.0.1:${address.port}`);
}

function installAiStub(t, implementation) {
  const originalStreamChat = aiService.streamChat;
  const originalChat = aiService.chat;
  const calls = [];

  aiService.streamChat = async function* streamChatStub(messages, options = {}) {
    calls.push({ messages, options });
    yield* implementation(messages, options);
  };
  aiService.chat = async () => ({ text: "fallback response" });

  t.after(() => {
    aiService.streamChat = originalStreamChat;
    aiService.chat = originalChat;
  });

  return calls;
}

function buildBody(text) {
  return {
    parts: [{ type: "text", purpose: "user", text }],
    context: { page: { title: "Chat test", url: "https://example.test/chat" } },
    enableRag: false,
  };
}

async function postChat(baseUrl, sessionId, body, headers = {}) {
  return fetch(
    `${baseUrl}/api/v1/chat/session/${encodeURIComponent(sessionId)}/message`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...headers,
      },
      body: JSON.stringify(body),
    },
  );
}

async function readSseEvents(response) {
  const body = await response.text();
  return body
    .split(/\r?\n\r?\n/)
    .map((frame) => frame.trim())
    .filter(Boolean)
    .map((frame) => frame.replace(/^data:\s?/gm, ""))
    .map((data) => JSON.parse(data));
}

test("chat message idempotency replays a completed SSE turn without a second AI call", async (t) => {
  const calls = installAiStub(t, async function* () {
    yield "cached answer";
  });

  await withServer(t, async (baseUrl) => {
    const sessionId = sessionService.createSession("idempotency-test");
    const body = buildBody("Explain idempotency");
    const headers = { "Idempotency-Key": "chat-turn-idem-1" };

    const first = await postChat(baseUrl, sessionId, body, headers);
    assert.equal(first.status, 200);
    const firstEvents = await readSseEvents(first);
    assert.deepEqual(
      firstEvents.filter((event) => event.type === "text").map((event) => event.text),
      ["cached answer"],
    );

    const sessionAfterFirst = sessionService.getSession(sessionId);
    assert.equal(sessionAfterFirst.messages.length, 2);
    assert.equal(calls.length, 1);

    const replay = await postChat(baseUrl, sessionId, body, headers);
    assert.equal(replay.status, 200);
    assert.equal(replay.headers.get("idempotency-replayed"), "true");
    const replayEvents = await readSseEvents(replay);

    assert.deepEqual(
      replayEvents.filter((event) => event.type === "text").map((event) => event.text),
      ["cached answer"],
    );
    assert.equal(calls.length, 1);
    assert.equal(sessionAfterFirst.messages.length, 2);
  });
});

test("chat idempotency rejects reused keys with different payloads", async (t) => {
  installAiStub(t, async function* () {
    yield "first answer";
  });

  await withServer(t, async (baseUrl) => {
    const sessionId = sessionService.createSession("idempotency-conflict-test");
    const headers = { "Idempotency-Key": "chat-turn-idem-conflict" };

    const first = await postChat(baseUrl, sessionId, buildBody("original"), headers);
    assert.equal(first.status, 200);
    await first.text();

    const conflict = await postChat(baseUrl, sessionId, buildBody("changed"), headers);
    assert.equal(conflict.status, 409);
    assert.deepEqual(await conflict.json(), {
      ok: false,
      error: {
        code: "IDEMPOTENCY_KEY_REUSED",
        message: "Idempotency-Key was reused with a different chat message payload",
      },
    });
  });
});

test("chat session turn lock rejects concurrent requests for the same session", async (t) => {
  let releaseStream;
  const streamGate = new Promise((resolve) => {
    releaseStream = resolve;
  });
  const calls = installAiStub(t, async function* () {
    await streamGate;
    yield "serialized answer";
  });

  await withServer(t, async (baseUrl) => {
    const sessionId = sessionService.createSession("concurrency-test");

    const first = await postChat(baseUrl, sessionId, buildBody("first"));
    assert.equal(first.status, 200);

    const second = await postChat(baseUrl, sessionId, buildBody("second"));
    assert.equal(second.status, 409);
    assert.equal(second.headers.get("retry-after"), "3");
    assert.deepEqual(await second.json(), {
      ok: false,
      error: {
        code: "CHAT_TURN_IN_PROGRESS",
        message: "Another chat turn is already in progress for this session",
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(sessionService.getSession(sessionId).messages.length, 1);

    releaseStream();
    const firstEvents = await readSseEvents(first);
    assert.deepEqual(
      firstEvents.filter((event) => event.type === "text").map((event) => event.text),
      ["serialized answer"],
    );
    assert.equal(sessionService.getSession(sessionId).messages.length, 2);
  });
});
