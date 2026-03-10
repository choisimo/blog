import { Router } from "express";
import { WebSocketServer } from "ws";
import { aiService, tryParseJson } from "../lib/ai-service.js";
import { config } from "../config.js";
import { openaiEmbeddings } from "../lib/openai-compat-client.js";
import openNotebook from "../services/open-notebook.service.js";
import { appendLiveContextMessage } from "../services/live-context.service.js";
import {
  CHROMA,
  AI_MODELS,
  AI_TEMPERATURES,
  STREAMING,
} from "../config/constants.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("chat");

// ---------------------------------------------------------------------------
// Service imports (extracted from this file)
// ---------------------------------------------------------------------------

import {
  isValidTaskMode,
  buildTaskPrompt,
  getFallbackData,
  normalizeTaskData,
  projectTaskDataFromText,
} from "../services/quiz.service.js";

import {
  createSession,
  getSession,
  ensureSessionNotebook,
  reinforceSessionNotebook,
  resolveMessageContexts,
  deriveUserQuery,
  getLiveContextForSession,
  setPerformRAGSearch,
} from "../services/session.service.js";

import {
  normalizeRoomKey,
  ensureLiveRoom,
  registerLiveStream,
  unregisterLiveStream,
  getRoomParticipantCount,
  getRoomParticipantCountGlobal,
  sendSSE,
  broadcastRoom,
  appendRoomHistory,
  ensureLiveRedisBridge,
  publishLiveEvent,
  emitRoomEvent,
  touchRedisPresence,
  removeRedisPresence,
  getPresenceKey,
  notifySession,
  shouldSkipAutoReply,
  normalizeAutoReply,
  buildAutoReplyText,
  getAgentPersonaName,
  scheduleAutoRoomReply,
  getLivePolicySnapshot,
  validateAndApplyLivePolicyUpdate,
  isLivePolicyWriteAuthorized,
  getRoomHistory,
  getLiveRoomKeys,
  getAllRoomHistoryEntries,
  getAllActiveStreamRooms,
} from "../services/live-chat.service.js";
import { getApplicationContainer } from "../application/bootstrap/container.js";

const router = Router();
const {
  services: { liveSessionAuthService },
} = getApplicationContainer();

// ---------------------------------------------------------------------------
// RAG infrastructure (stays here — tightly coupled to config.rag)
// ---------------------------------------------------------------------------

const ragCollectionCache = new Map();

function readHeaderValue(value) {
  if (Array.isArray(value)) return value[0];
  if (typeof value === "string") return value;
  return undefined;
}

function resolveChatModelFromRequest(req) {
  const forced = readHeaderValue(req?.headers?.["x-ai-model"])?.trim();
  if (forced) return forced;
  return config.ai?.defaultModel || AI_MODELS.DEFAULT;
}

function getChromaCollectionsBase() {
  return `${config.rag.chromaUrl}/api/v2/tenants/${CHROMA.TENANT}/databases/${CHROMA.DATABASE}/collections`;
}

async function getCollectionUUID(collectionName) {
  if (ragCollectionCache.has(collectionName)) {
    return ragCollectionCache.get(collectionName);
  }

  try {
    const collectionsUrl = getChromaCollectionsBase();
    const listResp = await fetch(collectionsUrl, { method: "GET" });

    if (!listResp.ok) return null;

    const collections = await listResp.json();
    const collection = collections.find((c) => c.name === collectionName);

    if (collection) {
      ragCollectionCache.set(collectionName, collection.id);
      return collection.id;
    }
  } catch {
    return null;
  }
  return null;
}

async function getEmbeddings(texts) {
  const result = await openaiEmbeddings(texts, {
    model: config.rag.embeddingModel,
    baseUrl: config.rag.embeddingUrl,
    apiKey: config.rag.embeddingApiKey,
  });

  return result.embeddings;
}

async function queryChroma(embedding, nResults = 5) {
  const collectionName = config.rag.chromaCollection;
  const collectionsBase = getChromaCollectionsBase();

  const collectionUUID = await getCollectionUUID(collectionName);
  if (!collectionUUID) {
    throw new Error(`Collection not found: ${collectionName}`);
  }

  const queryUrl = `${collectionsBase}/${collectionUUID}/query`;
  const response = await fetch(queryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query_embeddings: [embedding],
      n_results: nResults,
      include: ["documents", "metadatas", "distances"],
    }),
  });

  if (!response.ok) {
    throw new Error(`ChromaDB error: ${response.status}`);
  }

  return response.json();
}

async function performRAGSearch(query, topK = 5) {
  try {
    const [embedding] = await getEmbeddings([query]);
    const chromaResult = await queryChroma(embedding, topK);

    const sources = [];
    const contextParts = [];

    if (chromaResult.documents && chromaResult.documents[0]) {
      const docs = chromaResult.documents[0];
      const metas = chromaResult.metadatas?.[0] || [];
      const dists = chromaResult.distances?.[0] || [];

      for (let i = 0; i < docs.length; i++) {
        const meta = metas[i] || {};
        const distance = dists[i];
        const score = distance != null ? Math.max(0, 1 - distance) : null;

        sources.push({
          title: meta.title || meta.post_title || "Untitled",
          url: meta.slug
            ? `/posts/${meta.year || new Date().getFullYear()}/${meta.slug}`
            : undefined,
          score,
          snippet: docs[i]?.slice(0, 200) || "",
        });

        const title = meta.title || meta.post_title || "";
        contextParts.push(
          `[${i + 1}] ${title ? `"${title}": ` : ""}${docs[i]}`,
        );
      }
    }

    const context =
      contextParts.length > 0
        ? `다음은 관련 블로그 포스트에서 발췌한 내용입니다:\n\n${contextParts.join("\n\n")}\n\n위 내용을 참고하여 답변해주세요.`
        : null;

    return { context, sources };
  } catch (err) {
    logger.warn({}, 'RAG search failed', { error: err.message });
    return { context: null, sources: [] };
  }
}

// Inject performRAGSearch into session.service so it can resolve RAG contexts
// without a circular import back to this file.
setPerformRAGSearch(performRAGSearch);

// ---------------------------------------------------------------------------
// Route-local constants
// ---------------------------------------------------------------------------

const CHAT_RESPONSE_TIMEOUT_MS = Math.max(
  5_000,
  Number.parseInt(process.env.CHAT_RESPONSE_TIMEOUT_MS || "45000", 10),
);

// ---------------------------------------------------------------------------
// Streaming utilities (used only by route handlers)
// ---------------------------------------------------------------------------

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitStreamingText(text, preferredSize) {
  const value = typeof text === "string" ? text : String(text || "");
  if (!value) return [];

  const chunkSize = Math.max(
    1,
    Number.parseInt(String(preferredSize || 0), 10) || 50,
  );

  if (value.length <= chunkSize) return [value];

  const chunks = [];
  let cursor = 0;

  while (cursor < value.length) {
    let end = Math.min(value.length, cursor + chunkSize);

    if (end < value.length) {
      const wordBoundary = value.lastIndexOf(" ", end);
      if (wordBoundary > cursor + Math.floor(chunkSize * 0.45)) {
        end = wordBoundary + 1;
      }
    }

    chunks.push(value.slice(cursor, end));
    cursor = end;
  }

  return chunks;
}

async function emitTextChunks({
  text,
  sendChunk,
  isClosed,
  chunkSize,
  chunkDelayMs = 0,
}) {
  if (typeof sendChunk !== "function") return "";
  const shouldStop = typeof isClosed === "function" ? isClosed : () => false;
  const delayMs = Math.max(
    0,
    Number.parseInt(String(chunkDelayMs || 0), 10) || 0,
  );

  const chunks = splitStreamingText(text, chunkSize);
  if (chunks.length === 0) return "";

  let emitted = "";
  for (let i = 0; i < chunks.length; i += 1) {
    if (shouldStop()) break;

    const piece = chunks[i];
    emitted += piece;
    sendChunk(piece);

    if (delayMs > 0 && i < chunks.length - 1) {
      await wait(delayMs);
    }
  }

  return emitted;
}

// ----------------------------------------------------------------------------
// WebSocket Chat Streaming
// ----------------------------------------------------------------------------
export function initChatWebSocket(server) {
  if (!server?.on) return null;

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host}`);
      if (url.pathname !== "/api/v1/chat/ws") return;

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request, url);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on("connection", (ws, request, url) => {
    let busy = false;
    let closed = false;
    const forcedModel = resolveChatModelFromRequest(request);

    const send = (payload) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };

    ws.on("message", async (data) => {
      if (busy || closed) {
        send({ type: "error", error: "busy" });
        return;
      }

      let payload = null;
      try {
        const raw = typeof data === "string" ? data : data.toString();
        payload = JSON.parse(raw);
      } catch {
        send({ type: "error", error: "invalid_json" });
        return;
      }

      if (!payload || payload.type !== "message") {
        if (payload?.type === "ping") {
          send({ type: "pong" });
          return;
        }
        send({ type: "error", error: "invalid_type" });
        return;
      }

      busy = true;
      try {
        let sessionId =
          payload.sessionId || url?.searchParams?.get("sessionId");
        let session = sessionId ? getSession(sessionId) : null;

        if (!session) {
          sessionId = createSession(payload.title);
          session = getSession(sessionId);
          if (openNotebook.isEnabled()) {
            void ensureSessionNotebook(sessionId).catch((err) => {
              logger.warn({}, 'Session notebook bootstrap failed', { error: err?.message });
            });
          }
        }

        let userMessage = "";
        if (Array.isArray(payload.parts)) {
          userMessage = payload.parts
            .filter((p) => p?.type === "text")
            .map((p) => p.text)
            .join("\n");
        } else if (typeof payload.parts === "string") {
          userMessage = payload.parts;
        } else if (typeof payload.text === "string") {
          userMessage = payload.text;
        }

        if (!userMessage.trim()) {
          send({ type: "error", error: "No message content" });
          return;
        }

        const pageContext = payload.context?.page || payload.context;
        if (pageContext?.url || pageContext?.title) {
          userMessage = `[Context: ${pageContext.title || ""} - ${pageContext.url || ""}]\n\n${userMessage}`;
        }

        session.lastActivityAt = Date.now();
        session.messages.push({ role: "user", content: userMessage });
        send({ type: "session", sessionId });

        const { notebookContext, ragContext, ragSources } =
          await resolveMessageContexts({
            userQuery: userMessage,
            session,
            enableRag: payload.enableRag === true,
          });

        if (ragSources.length > 0) {
          send({ type: "sources", sources: ragSources });
        }

        let messagesWithContext = [...session.messages];
        const liveContext = getLiveContextForSession(sessionId);
        const contextParts = [liveContext, ragContext, notebookContext].filter(
          Boolean,
        );

        if (contextParts.length > 0) {
          const lastIdx = messagesWithContext.length - 1;
          if (lastIdx >= 0 && messagesWithContext[lastIdx].role === "user") {
            messagesWithContext[lastIdx] = {
              ...messagesWithContext[lastIdx],
              content:
                `${contextParts.join("\n\n")}` +
                `\n\n---\n\n사용자 질문: ${messagesWithContext[lastIdx].content}`,
            };
          }
        }

        let text = "";
        try {
          for await (const chunk of aiService.streamChat(messagesWithContext, {
            model: forcedModel,
            timeout: CHAT_RESPONSE_TIMEOUT_MS,
          })) {
            const emitted = await emitTextChunks({
              text: chunk,
              chunkSize: STREAMING.WS_CHUNK_SIZE,
              chunkDelayMs: 0,
              isClosed: () => closed || ws.readyState !== ws.OPEN,
              sendChunk: (piece) => send({ type: "text", text: piece }),
            });
            text += emitted;
          }
        } catch (streamErr) {
          if (!text) {
            const fallback = await aiService.chat(messagesWithContext, {
              model: forcedModel,
              timeout: CHAT_RESPONSE_TIMEOUT_MS,
            });
            const fallbackText = fallback.content || "";
            if (!closed && ws.readyState === ws.OPEN && fallbackText) {
              text += await emitTextChunks({
                text: fallbackText,
                chunkSize: STREAMING.WS_CHUNK_SIZE,
                chunkDelayMs: STREAMING.WS_CHUNK_DELAY,
                isClosed: () => closed || ws.readyState !== ws.OPEN,
                sendChunk: (piece) => send({ type: "text", text: piece }),
              });
            }
          } else {
            throw streamErr;
          }
        }

        if (!text.trim()) {
          throw new Error("AI returned empty response");
        }

        session.lastActivityAt = Date.now();
        session.messages.push({ role: "assistant", content: text });
        void reinforceSessionNotebook(session, userMessage, text);
        notifySession(sessionId, {
          level: "info",
          message: "AI response completed",
        });
        send({ type: "done" });
      } catch (err) {
        send({ type: "error", error: err?.message || "chat failed" });
      } finally {
        busy = false;
      }
    });

    ws.on("close", () => {
      closed = true;
    });

    ws.on("error", () => {
      closed = true;
    });
  });

  return wss;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/chat/session
 * Create new chat session
 */
router.post("/session", async (req, res, next) => {
  try {
    const { title } = req.body || {};
    const sessionId = createSession(title);
    const session = getSession(sessionId);

    if (openNotebook.isEnabled()) {
      void ensureSessionNotebook(sessionId).catch((err) => {
        logger.warn({}, 'Notebook provisioning during session creation failed', { error: err?.message });
      });
    }

    return res.json({
      ok: true,
      data: {
        sessionID: sessionId,
        id: sessionId,
        notebookId: session?.notebookId || null,
        notebookReady: session?.notebookReady === true,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/chat/session/:sessionId/message
 * Send chat message (SSE streaming)
 */
router.post("/session/:sessionId/message", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { parts, context, enableRag } = req.body || {};
    const forcedModel = resolveChatModelFromRequest(req);
    let effectiveSessionId = sessionId;

    // Get or create session
    let session = getSession(sessionId);
    if (!session) {
      effectiveSessionId = createSession();
      session = getSession(effectiveSessionId);
      if (openNotebook.isEnabled()) {
        void ensureSessionNotebook(effectiveSessionId).catch((err) => {
          logger.warn({}, 'Session notebook bootstrap failed', { error: err?.message });
        });
      }
    }

    // Extract text from parts
    let userMessage = "";
    if (Array.isArray(parts)) {
      userMessage = parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n");
    } else if (typeof parts === "string") {
      userMessage = parts;
    }

    if (!userMessage.trim()) {
      return res.status(400).json({ ok: false, error: "No message content" });
    }

    // Add context if available
    const pageContext = context?.page;
    if (pageContext?.url || pageContext?.title) {
      userMessage = `[Context: ${pageContext.title || ""} - ${pageContext.url || ""}]\n\n${userMessage}`;
    }

    // Store message
    session.lastActivityAt = Date.now();
    session.messages.push({ role: "user", content: userMessage });

    // Set up SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const send = (data) => {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      res.write(`data: ${payload}\n\n`);
    };

    send({ type: "session", sessionId: effectiveSessionId });

    let closed = false;
    req.on("close", () => {
      closed = true;
    });

    const heartbeatInterval = setInterval(() => {
      if (!closed) {
        send({ type: "heartbeat", ts: Date.now() });
      }
    }, 15000);

    try {
      const userQuery = deriveUserQuery(parts, userMessage);
      const { notebookContext, ragContext, ragSources } =
        await resolveMessageContexts({
          userQuery,
          session,
          enableRag,
        });

      if (ragSources.length > 0) {
        send({ type: "sources", sources: ragSources });
      }

      let messagesWithContext = [...session.messages];
      const liveContext = getLiveContextForSession(effectiveSessionId);
      const contextParts = [liveContext, ragContext, notebookContext].filter(
        Boolean,
      );
      if (contextParts.length > 0) {
        const lastIdx = messagesWithContext.length - 1;
        if (lastIdx >= 0 && messagesWithContext[lastIdx].role === "user") {
          messagesWithContext[lastIdx] = {
            ...messagesWithContext[lastIdx],
            content:
              `${contextParts.join("\n\n")}` +
              `\n\n---\n\n사용자 질문: ${messagesWithContext[lastIdx].content}`,
          };
        }
      }

      if (closed) {
        clearInterval(heartbeatInterval);
        return res.end();
      }

      let text = "";
      try {
        for await (const chunk of aiService.streamChat(messagesWithContext, {
          model: forcedModel,
          timeout: CHAT_RESPONSE_TIMEOUT_MS,
        })) {
          const emitted = await emitTextChunks({
            text: chunk,
            chunkSize: STREAMING.CHUNK_SIZE,
            chunkDelayMs: 0,
            isClosed: () => closed,
            sendChunk: (piece) => send({ type: "text", text: piece }),
          });
          text += emitted;
        }
      } catch (streamErr) {
        if (!text) {
          const fallback = await aiService.chat(messagesWithContext, {
            model: forcedModel,
            timeout: CHAT_RESPONSE_TIMEOUT_MS,
          });
          const fallbackText = fallback.content || "";
          if (!closed && fallbackText) {
            text += await emitTextChunks({
              text: fallbackText,
              chunkSize: STREAMING.CHUNK_SIZE,
              chunkDelayMs: STREAMING.CHUNK_DELAY,
              isClosed: () => closed,
              sendChunk: (piece) => send({ type: "text", text: piece }),
            });
          }
        } else {
          throw streamErr;
        }
      }

      if (!text.trim()) {
        throw new Error("AI returned empty response");
      }

      session.lastActivityAt = Date.now();
      session.messages.push({ role: "assistant", content: text });
      void reinforceSessionNotebook(session, userMessage, text);

      notifySession(effectiveSessionId, {
        level: "info",
        message: "AI response completed",
      });

      send({ type: "done" });
    } catch (err) {
      logger.error({}, 'Chat streaming error', { error: err.message });
      send({ type: "error", error: err.message || "Chat failed" });
    }

    clearInterval(heartbeatInterval);
    res.end();
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/chat/live/stream
 * Live visitor chat stream (SSE)
 */
router.get("/live/stream", async (req, res, next) => {
  try {
    await ensureLiveRedisBridge();

    const roomRaw =
      typeof req.query.room === "string" ? req.query.room : "room:lobby";
    const room = normalizeRoomKey(roomRaw);

    const sessionIdRaw =
      typeof req.query.sessionId === "string" ? req.query.sessionId : "";
    const resolvedSession = await liveSessionAuthService.resolveLiveSessionId(
      req,
      sessionIdRaw,
    );

    const nameRaw = typeof req.query.name === "string" ? req.query.name : "";
    const name =
      nameRaw.trim().slice(0, 40) ||
      `visitor-${Math.random().toString(36).slice(2, 6)}`;

    if (!resolvedSession.ok) {
      return res
        .status(
          resolvedSession.status || (resolvedSession.authProvided ? 401 : 400),
        )
        .json({ ok: false, error: resolvedSession.error });
    }
    const sessionId = resolvedSession.sessionId;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const streamId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerLiveStream({ id: streamId, room, sessionId, name, res });
    await touchRedisPresence(room, sessionId);

    const connectedCount = await getRoomParticipantCountGlobal(room);

    sendSSE(res, {
      type: "connected",
      room,
      sessionId,
      senderType: "client",
      onlineCount: connectedCount,
      ts: new Date().toISOString(),
    });

    const joinedCount = await getRoomParticipantCountGlobal(room);
    await emitRoomEvent(room, {
      type: "presence",
      room,
      action: "join",
      senderType: "client",
      sessionId,
      name,
      onlineCount: joinedCount,
      ts: new Date().toISOString(),
    });

    const keepAlive = setInterval(() => {
      void touchRedisPresence(room, sessionId);
      sendSSE(res, { type: "ping", ts: new Date().toISOString() });
    }, 25_000);

    req.on("close", async () => {
      clearInterval(keepAlive);
      unregisterLiveStream(streamId);
      await removeRedisPresence(room, sessionId);
      const leaveCount = await getRoomParticipantCountGlobal(room);
      await emitRoomEvent(room, {
        type: "presence",
        room,
        action: "leave",
        senderType: "client",
        sessionId,
        name,
        onlineCount: leaveCount,
        ts: new Date().toISOString(),
      });
      try {
        res.end();
      } catch {
        // ignore
      }
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/chat/live/message
 * Send live visitor chat message
 */
router.post("/live/message", async (req, res, next) => {
  try {
    await ensureLiveRedisBridge();

    const body = req.body || {};
    const roomRaw = typeof body.room === "string" ? body.room : "room:lobby";
    const room = normalizeRoomKey(roomRaw);

    const sessionIdBody =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const resolvedSession = await liveSessionAuthService.resolveLiveSessionId(
      req,
      sessionIdBody,
    );

    const text = typeof body.text === "string" ? body.text.trim() : "";
    const senderTypeRaw =
      typeof body.senderType === "string" ? body.senderType : "client";
    const senderType =
      senderTypeRaw === "agent" && isLivePolicyWriteAuthorized(req)
        ? "agent"
        : "client";
    const nameRaw = typeof body.name === "string" ? body.name : "";
    const name =
      nameRaw.trim().slice(0, 40) ||
      `visitor-${Math.random().toString(36).slice(2, 6)}`;

    if (!resolvedSession.ok) {
      return res
        .status(
          resolvedSession.status || (resolvedSession.authProvided ? 401 : 400),
        )
        .json({ ok: false, error: resolvedSession.error });
    }
    const sessionId = resolvedSession.sessionId;

    if (!text) {
      return res.status(400).json({ ok: false, error: "text is required" });
    }

    if (text.length > 600) {
      return res.status(400).json({ ok: false, error: "text is too long" });
    }

    const ts = new Date().toISOString();
    appendRoomHistory(room, {
      sessionId,
      name,
      text,
      senderType,
      ts,
    });
    appendLiveContextMessage({
      sessionId,
      room,
      name,
      text,
      senderType,
      ts,
    });

    const messagePayload = {
      type: "live_message",
      room,
      sessionId,
      senderType,
      name,
      text,
      ts,
      onlineCount: await getRoomParticipantCountGlobal(room),
    };

    await emitRoomEvent(room, messagePayload);

    notifySession(sessionId, {
      level: "info",
      message: "Your live message was delivered",
      room,
    });

    if (
      senderType === "client" &&
      (await getRoomParticipantCountGlobal(room)) <= 1
    ) {
      scheduleAutoRoomReply({
        room,
        triggerSessionId: sessionId,
        triggerName: name,
        triggerText: text,
      });
    }

    return res.json({
      ok: true,
      data: {
        delivered: true,
        room,
        onlineCount: await getRoomParticipantCountGlobal(room),
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/chat/live/config
 * Live auto-responder tunables (read-only)
 */
router.get("/live/config", async (req, res, next) => {
  try {
    await ensureLiveRedisBridge();
    return res.json({
      ok: true,
      data: {
        policy: getLivePolicySnapshot(),
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * PUT /api/v1/chat/live/config
 * Update live auto-responder tunables (requires X-Live-Config-Key)
 */
router.put("/live/config", async (req, res, next) => {
  try {
    if (!isLivePolicyWriteAuthorized(req)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const result = validateAndApplyLivePolicyUpdate(req.body || {});
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }

    return res.json({
      ok: true,
      data: {
        policy: result.policy,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/chat/live/room-stats?room=<room>
 */
router.get("/live/room-stats", async (req, res, next) => {
  try {
    await ensureLiveRedisBridge();
    const roomRaw =
      typeof req.query.room === "string" ? req.query.room : "room:lobby";
    const room = normalizeRoomKey(roomRaw);

    const onlineCount = await getRoomParticipantCountGlobal(room);
    const recent = getRoomHistory(room).slice(-10);

    return res.json({
      ok: true,
      data: {
        room,
        onlineCount,
        recent,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/live/rooms", async (req, res, next) => {
  try {
    await ensureLiveRedisBridge();
    // Collect all rooms that have had activity (in-memory history)
    const rooms = [];
    for (const [roomKey, history] of getAllRoomHistoryEntries()) {
      if (history.length === 0) continue;
      const onlineCount = await getRoomParticipantCountGlobal(roomKey);
      const lastMsg = history[history.length - 1];
      rooms.push({
        room: roomKey,
        onlineCount,
        messageCount: history.length,
        lastActivity: lastMsg?.ts || null,
        lastText: lastMsg?.text ? lastMsg.text.slice(0, 60) : null,
      });
    }
    // Also include rooms with active SSE connections but no history yet
    for (const activeRoom of getAllActiveStreamRooms()) {
      if (!rooms.some((r) => r.room === activeRoom)) {
        const onlineCount = await getRoomParticipantCountGlobal(activeRoom);
        if (onlineCount > 0) {
          rooms.push({
            room: activeRoom,
            onlineCount,
            messageCount: 0,
            lastActivity: null,
            lastText: null,
          });
        }
      }
    }
    rooms.sort(
      (a, b) =>
        b.onlineCount - a.onlineCount || b.messageCount - a.messageCount,
    );
    return res.json({ ok: true, data: { rooms } });
  } catch (err) {
    return next(err);
  }
});
/**
 * POST /api/v1/chat/session/:sessionId/task
 * Execute inline AI task (sketch, prism, chain, etc.)
 */
router.post("/session/:sessionId/task", async (req, res, next) => {
  try {
    const { mode, payload, context, prompt: legacyPrompt } = req.body || {};

    // Validate mode
    const taskMode = isValidTaskMode(mode) ? mode : "custom";
    const taskPayload = payload || {};

    // Legacy compatibility
    if (legacyPrompt && legacyPrompt.trim() && taskMode === "custom") {
      taskPayload.prompt = legacyPrompt;
    }

    // Validate content
    const content =
      taskPayload.paragraph || taskPayload.content || taskPayload.prompt || "";
    if (!content.trim()) {
      return res
        .status(400)
        .json({ ok: false, error: "No content provided for task" });
    }

    try {
      // Build prompt
      const { prompt, temperature } = buildTaskPrompt(taskMode, taskPayload);

      // Execute via aiService
      const text = await aiService.generate(prompt, { temperature });

      // Debug: log raw AI response
      logger.debug({ taskMode }, 'Raw AI response', { preview: text?.slice(0, 500) });

      // Parse response based on mode
      let data;
      if (taskMode === "custom" || taskMode === "summary") {
        data = taskMode === "summary" ? { summary: text } : { text };
      } else {
        const json = tryParseJson(text);
        if (json) {
          const normalized = normalizeTaskData(taskMode, json, taskPayload);
          if (normalized) {
            data = normalized;
            logger.debug({ taskMode }, 'Successfully parsed and normalized JSON', { preview: JSON.stringify(data).slice(0, 200) });
          } else {
            logger.warn({ taskMode }, 'Parsed JSON failed schema validation, projecting text result');
            data = projectTaskDataFromText(taskMode, text, taskPayload);
          }
        } else {
          logger.warn({ taskMode }, 'JSON parse failed, projecting text result');
          data = projectTaskDataFromText(taskMode, text, taskPayload);
        }
      }

      return res.json({
        ok: true,
        data,
        mode: taskMode,
        source: "ai-service",
      });
    } catch (err) {
      logger.warn({}, 'Task execution failed, returning fallback', { error: err.message });
      const fallbackData = getFallbackData(taskMode, taskPayload);
      return res.json({
        ok: true,
        data: fallbackData,
        mode: taskMode,
        source: "fallback",
        _fallback: true,
      });
    }
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/chat/aggregate
 * Aggregate multiple session summaries
 */
router.post("/aggregate", async (req, res, next) => {
  try {
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ ok: false, error: "prompt is required" });
    }

    const systemPrompt = [
      "다음 입력에는 여러 대화 세션의 요약과 사용자의 통합 질문이 함께 포함되어 있습니다.",
      "먼저 세션 요약들을 충분히 이해한 뒤, 사용자의 요청에 따라 전체를 한 번에 통합하여 답변해 주세요.",
      "- 공통된 핵심 아이디어",
      "- 서로 다른 관점이나 긴장 지점",
      "- 다음 액션/실천 아이디어",
      "를 중심으로 한국어로 정리해 주세요.",
      "",
      "---",
      "",
      prompt.trim(),
    ].join("\n");

    const text = await aiService.generate(systemPrompt, {
      temperature: AI_TEMPERATURES.AGGREGATE,
    });
    return res.json({ ok: true, data: { text } });
  } catch (err) {
    return next(err);
  }
});

export default router;
