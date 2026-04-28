/**
 * Agent Routes
 *
 * AI Agent Orchestration Layer API endpoints
 * Provides access to the Agent Coordinator for multi-turn conversations,
 * tool execution, and memory-enhanced interactions.
 *
 * Endpoints:
 * - POST /api/v1/agent/run - Run agent with message (non-streaming)
 * - POST /api/v1/agent/stream - Run agent with streaming response
 * - GET /api/v1/agent/session/:sessionId - Get session details
 * - DELETE /api/v1/agent/session/:sessionId - Clear session
 * - GET /api/v1/agent/sessions - List all sessions for a user
 * - GET /api/v1/agent/health - Agent health check
 * - GET /api/v1/agent/tools - List available tools
 */

import express from "express";
import {
  AgentCoordinator,
  createAgentCoordinator,
  getAgentCoordinator,
} from "../lib/agent/coordinator.js";
import {
  buildSystemPrompt,
  SYSTEM_PROMPTS,
} from "../lib/agent/prompts/system.js";
import { normalizeMode, listAgentModes } from "../lib/agent/mode-registry.js";
import { getSessionMemory } from "../lib/agent/memory/session.js";
import { requireFeature } from "../middleware/featureFlags.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { validateBody } from "../middleware/validation.js";
import {
  agentRunBodySchema,
  memoryExtractBodySchema,
  memorySearchBodySchema,
} from "../middleware/schemas/agent.schema.js";
import { buildLiveContextPrompt } from "../services/live-context.service.js";
import { createLogger } from "../lib/logger.js";

import { broadcastNotification } from "./notifications.js";
const router = express.Router();
const logger = createLogger("agent");

router.use(requireFeature("ai"));
router.use(requireAdmin);

/**
 * Get or create the singleton agent coordinator
 */
function getCoordinator() {
  return getAgentCoordinator();
}

function resolveMaxIterations(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.max(1, Math.min(10, Math.floor(parsed)));
}

function enrichAgentMessageWithLiveContext(message, sessionId) {
  if (!sessionId || typeof message !== "string" || !message.trim()) {
    return message;
  }

  const liveContext = buildLiveContextPrompt(sessionId, {
    limit: 8,
    includeAgents: false,
  });

  if (!liveContext) {
    return message;
  }

  return `${liveContext}\n\n---\n\n현재 요청:\n${message}`;
}

// ============================================================================
// RUN ENDPOINTS
// ============================================================================

/**
 * POST /run - Run agent with message (non-streaming)
 *
 * Request Body:
 * {
 *   message: string,              // User message
 *   sessionId?: string,           // Session ID (auto-generated if not provided)
 *   mode?: string,                // Agent mode: default, research, coding, blog, article, terminal, performance
 *   articleSlug?: string,         // Article slug (for article mode)
 *   tools?: string[],             // Enabled tools (default: all)
 *   temperature?: number,         // Temperature override
 *   maxIterations?: number,       // Max tool iterations
 *   userId?: string,              // User ID for memory
 * }
 *
 * Response:
 * {
 *   ok: true,
 *   data: {
 *     response: string,
 *     sessionId: string,
 *     toolsUsed: string[],
 *     memoryUpdated: boolean,
 *     model: string,
 *     tokens: { prompt, completion, total }
 *   }
 * }
 */
router.post("/run", validateBody(agentRunBodySchema), async (req, res) => {
  try {
    const {
      message,
      sessionId,
      mode = "default",
      articleSlug,
      tools,
      temperature,
      maxIterations,
      userId = "default-user",
    } = req.body;

    const coordinator = getCoordinator();
    const effectiveMessage = enrichAgentMessageWithLiveContext(
      message,
      sessionId,
    );
    const effectiveMaxIterations = resolveMaxIterations(maxIterations);

    const result = await coordinator.run({
      sessionId,
      messages: [{ role: "user", content: effectiveMessage }],
      mode: normalizeMode(mode),
      context: {
        articleSlug,
        userId,
      },
      options: {
        temperature,
        maxIterations: effectiveMaxIterations,
      },
    });

    res.json({
      ok: true,
      data: {
        response: result.content,
        sessionId: result.sessionId || sessionId,
        toolsUsed: result.toolCalls?.map((tc) => tc.function?.name) || [],
        memoryUpdated: true,
        model: result.model,
        tokens: result.usage,
      },
    });
  } catch (err) {
    logger.error({}, 'Agent run error', { error: err.message, stack: err.stack });
    res.status(500).json({
      ok: false,
      error: { message: err.message, code: "INTERNAL_ERROR" },
    });
  }
});

/**
 * POST /stream - Run agent with streaming response
 *
 * Request Body: Same as /run
 *
 * Response: Server-Sent Events stream
 * - event: open - Connection established
 * - event: token - Token chunk
 * - event: tool_start - Tool execution started
 * - event: tool_end - Tool execution completed
 * - event: done - Stream completed
 * - event: error - Error occurred
 */
router.post("/stream", validateBody(agentRunBodySchema), async (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (event, data) => {
    try {
      if (event) res.write(`event: ${event}\n`);
      if (data !== undefined) {
        const payload = typeof data === "string" ? data : JSON.stringify(data);
        res.write(`data: ${payload}\n`);
      }
      res.write("\n");
    } catch (e) {
      // Ignore write errors (client disconnected)
    }
  };

  let closed = false;
  const onClose = () => {
    closed = true;
    clearInterval(ping);
    try {
      res.end();
    } catch (e) {}
  };

  req.on("close", onClose);
  req.on("error", onClose);

  // Keep-alive ping
  const ping = setInterval(() => {
    if (!closed) send("ping", {});
  }, 25000);

  try {
    const {
      message,
      sessionId,
      mode = "default",
      articleSlug,
      tools,
      temperature,
      maxIterations,
      userId = "default-user",
    } = req.body;

    send("open", { type: "open" });

    const coordinator = getCoordinator();
    const effectiveMessage = enrichAgentMessageWithLiveContext(
      message,
      sessionId,
    );
    const effectiveMaxIterations = resolveMaxIterations(maxIterations);

    const AGENT_STREAM_TIMEOUT_MS = 120_000;
    let streamTimedOut = false;
    const streamTimeout = setTimeout(() => {
      streamTimedOut = true;
      if (!closed) {
        send('error', { message: 'Stream timeout after 120 seconds', code: 'STREAM_TIMEOUT' });
        onClose();
      }
    }, AGENT_STREAM_TIMEOUT_MS);

    try {
      for await (const event of coordinator.stream({
        sessionId,
        messages: [{ role: "user", content: effectiveMessage }],
        mode: normalizeMode(mode),
        context: {
          articleSlug,
          userId,
        },
        options: {
          temperature,
          maxIterations: effectiveMaxIterations,
        },
      })) {
        if (closed || streamTimedOut) break;


        switch (event.type) {
          case "text":
            send("token", { token: event.data });
            break;
          case "tool_start":
            send("tool_start", { tool: event.data.name, id: event.data.id });
            break;
          case "tool_end":
            if (
              event.data.result?.results &&
              Array.isArray(event.data.result.results)
            ) {
              let sources = [];

              if (event.data.name === "web_search") {
                sources = event.data.result.results.map((r) => ({
                  title: r.title || "Web Result",
                  url: r.url,
                  snippet: r.snippet,
                  score: r.score,
                }));
              } else if (event.data.name === "rag_search") {
                sources = event.data.result.results.map((r) => ({
                  title: r.title || r.slug,
                  url: r.slug ? `/posts/${r.slug}` : undefined,
                  snippet: r.content?.slice(0, 150) + "...",
                  score: parseFloat(r.score),
                }));
              }

              if (sources.length > 0) {
                send("sources", { sources });
              }
            }

            send("tool_end", {
              tool: event.data.name,
              result: summarizeToolResult(event.data.result),
            });
            break;
          case "tool_error":
            send("tool_error", {
              tool: event.data.name,
              error: event.data.error,
            });
            break;
          case "error":
            send("error", { message: event.data.message });
            broadcastNotification("error", {
              type: "error",
              title: "AI Agent 오류",
              message: event.data.message ?? "알 수 없는 오류가 발생했습니다.",
              payload: { sessionId },
            });
            break;
        }
      }
    } catch (streamError) {
      send("error", { message: streamError.message, code: "STREAM_ERROR" });
    } finally {
      clearTimeout(streamTimeout);
    }


    onClose();
  } catch (streamError) {
    logger.error({}, 'Stream error', { error: streamError.message, stack: streamError.stack });
    if (!closed) {
      send('error', { message: 'Stream processing error', code: 'STREAM_ERROR' });
    }
  }
});

/**
 * Summarize tool result for streaming (avoid sending too much data)
 */
function summarizeToolResult(result) {
  if (!result) return null;
  if (typeof result === "string") {
    return result.length > 500 ? result.slice(0, 500) + "..." : result;
  }
  if (Array.isArray(result)) {
    return { count: result.length, preview: result.slice(0, 3) };
  }
  if (typeof result === "object") {
    const str = JSON.stringify(result);
    if (str.length > 500) {
      return { summary: "Object with keys: " + Object.keys(result).join(", ") };
    }
    return result;
  }
  return result;
}

// ============================================================================
// SESSION MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /session/:sessionId - Get session details
 */
router.get("/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const coordinator = getCoordinator();

    const session = await coordinator.getSession(sessionId);
    if (!session || !session.history || session.history.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: "Session not found", code: "NOT_FOUND" },
      });
    }

    res.json({
      ok: true,
      data: {
        sessionId,
        messageCount: session.history?.length || 0,
        metadata: session.metadata,
        // Include last few messages for context
        recentMessages: (session.history || []).slice(-10).map((m) => ({
          role: m.role,
          content:
            typeof m.content === "string"
              ? m.content.slice(0, 200) + (m.content.length > 200 ? "..." : "")
              : "[complex content]",
          timestamp: m.timestamp,
        })),
      },
    });
  } catch (err) {
    logger.error({}, 'Get session error', { error: err.message, stack: err.stack });
    res.status(500).json({
      ok: false,
      error: { message: err.message, code: "INTERNAL_ERROR" },
    });
  }
});

/**
 * DELETE /session/:sessionId - Clear session
 */
router.delete("/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const coordinator = getCoordinator();

    await coordinator.clearSession(sessionId);

    res.json({
      ok: true,
      data: { deleted: true, sessionId },
    });
  } catch (err) {
    logger.error({}, 'Delete session error', { error: err.message, stack: err.stack });
    res.status(500).json({
      ok: false,
      error: { message: err.message, code: "INTERNAL_ERROR" },
    });
  }
});

/**
 * GET /sessions - List all sessions (with pagination)
 */
router.get("/sessions", async (req, res) => {
  try {
    const { userId = "default-user", limit = 20, offset = 0 } = req.query;
    const sessionMemory = getSessionMemory();

    // Note: In-memory store may not support full listing,
    // this would need persistent store for proper implementation
    const sessions =
      (await sessionMemory.listSessions?.({
        userId,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      })) || [];

    res.json({
      ok: true,
      data: {
        sessions: sessions || [],
        total: sessions?.length || 0,
      },
    });
  } catch (err) {
    logger.error({}, 'List sessions error', { error: err.message, stack: err.stack });
    res.status(500).json({
      ok: false,
      error: { message: err.message, code: "INTERNAL_ERROR" },
    });
  }
});

// ============================================================================
// UTILITY ENDPOINTS
// ============================================================================

/**
 * GET /health - Agent health check
 */
router.get("/health", async (req, res) => {
  try {
    const coordinator = getCoordinator();
    const health = await coordinator.health();

    res.json({
      ok: health.ok,
      data: {
        status: health.ok ? "healthy" : "degraded",
        llm: health.llm,
        tools: health.tools,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error({}, 'Agent health error', { error: err.message, stack: err.stack });
    res.status(500).json({
      ok: false,
      data: {
        status: "error",
        error: err.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /tools - List available tools
 */
router.get("/tools", async (req, res) => {
  try {
    const coordinator = getCoordinator();
    const health = await coordinator.health();
    const toolNames = health.tools?.names || [];

    res.json({
      ok: true,
      data: {
        tools: toolNames.map((name) => ({
          name,
          enabled: true,
        })),
        total: toolNames.length,
      },
    });
  } catch (err) {
    logger.error({}, 'List tools error', { error: err.message, stack: err.stack });
    res.status(500).json({
      ok: false,
      error: { message: err.message, code: "INTERNAL_ERROR" },
    });
  }
});

/**
 * GET /modes - List available agent modes
 */
router.get("/modes", (req, res) => {
  res.json({
    ok: true,
    data: {
      modes: listAgentModes(),
    },
  });
});

// ============================================================================
// MEMORY ENDPOINTS
// ============================================================================

/**
 * POST /memory/extract - Extract memories from conversation
 */
router.post("/memory/extract", validateBody(memoryExtractBodySchema), async (req, res) => {
  try {
    const { sessionId, messages } = req.body;

    const coordinator = getCoordinator();
    const memories = await coordinator.extractMemories(messages);

    res.json({
      ok: true,
      data: {
        memories: memories || [],
        count: memories?.length || 0,
      },
    });
  } catch (err) {
    logger.error({}, 'Memory extract error', { error: err.message, stack: err.stack });
    res.status(500).json({
      ok: false,
      error: { message: err.message, code: "INTERNAL_ERROR" },
    });
  }
});

/**
 * POST /memory/search - Search memories semantically
 */
router.post("/memory/search", validateBody(memorySearchBodySchema), async (req, res) => {
  try {
    const { query, userId = "default-user", limit = 10 } = req.body;

    const coordinator = getCoordinator();
    const results = await coordinator.searchMemories(query, { userId, limit });

    res.json({
      ok: true,
      data: {
        results: results || [],
        count: results?.length || 0,
      },
    });
  } catch (err) {
    logger.error({}, 'Memory search error', { error: err.message, stack: err.stack });
    res.status(500).json({
      ok: false,
      error: { message: err.message, code: "INTERNAL_ERROR" },
    });
  }
});
// ============================================================================
// ADMIN: AGENT PROMPT MANAGEMENT
// ============================================================================

/**
 * Runtime prompt overrides (in-memory, resets on restart).
 * key = mode name (e.g. "default"), value = overridden prompt text
 */
const promptOverrides = new Map();

const MODE_LABELS = {
  default: 'Default',
  research: 'Research',
  coding: 'Coding',
  blog: 'Blog Writing',
  article: 'Article Q&A',
  terminal: 'Terminal',
  performance: 'Performance',
};

/**
 * GET /prompts — list all agent modes with their current prompt text
 * Admin-only
 */
router.get('/prompts', requireAdmin, (req, res) => {
  const prompts = Object.keys(SYSTEM_PROMPTS).map((mode) => ({
    mode,
    label: MODE_LABELS[mode] || mode,
    text: promptOverrides.has(mode) ? promptOverrides.get(mode) : SYSTEM_PROMPTS[mode],
    isOverridden: promptOverrides.has(mode),
  }));
  res.json({ ok: true, data: { prompts } });
});

/**
 * PUT /prompts/:mode — update a prompt mode's text at runtime
 * Admin-only
 */
router.put('/prompts/:mode', requireAdmin, (req, res) => {
  const { mode } = req.params;
  const { text } = req.body;

  if (!SYSTEM_PROMPTS[mode]) {
    return res.status(400).json({
      ok: false,
      error: { message: `Unknown mode: ${mode}. Valid modes: ${Object.keys(SYSTEM_PROMPTS).join(', ')}`, code: 'INVALID_MODE' },
    });
  }

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      ok: false,
      error: { message: 'text must be a non-empty string', code: 'INVALID_REQUEST' },
    });
  }

  promptOverrides.set(mode, text.trim());
  logger.info({}, 'Agent prompt override set', { mode, length: text.length });

  res.json({
    ok: true,
    data: {
      mode,
      label: MODE_LABELS[mode] || mode,
      text: text.trim(),
      isOverridden: true,
    },
  });
});

/**
 * DELETE /prompts/:mode — reset a prompt mode to its default
 * Admin-only
 */
router.delete('/prompts/:mode', requireAdmin, (req, res) => {
  const { mode } = req.params;

  if (!SYSTEM_PROMPTS[mode]) {
    return res.status(400).json({
      ok: false,
      error: { message: `Unknown mode: ${mode}`, code: 'INVALID_MODE' },
    });
  }

  promptOverrides.delete(mode);
  logger.info({}, 'Agent prompt override reset', { mode });

  res.json({
    ok: true,
    data: {
      mode,
      label: MODE_LABELS[mode] || mode,
      text: SYSTEM_PROMPTS[mode],
      isOverridden: false,
    },
  });
});

export default router;
