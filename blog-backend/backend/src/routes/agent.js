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

import express from 'express';
import { AgentCoordinator, createAgentCoordinator, getAgentCoordinator } from '../lib/agent/coordinator.js';
import { buildSystemPrompt, SYSTEM_PROMPTS } from '../lib/agent/prompts/system.js';
import { getSessionMemory } from '../lib/agent/memory/session.js';
import { requireFeature } from '../middleware/featureFlags.js';

const router = express.Router();

router.use(requireFeature('ai'));

/**
 * Get or create the singleton agent coordinator
 */
function getCoordinator() {
  return getAgentCoordinator();
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
 *   mode?: string,                // Agent mode: default, research, coding, blog, article, terminal
 *   articleSlug?: string,         // Article slug (for article mode)
 *   tools?: string[],             // Enabled tools (default: all)
 *   model?: string,               // Model override
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
router.post('/run', async (req, res) => {
  try {
    const {
      message,
      sessionId,
      mode = 'default',
      articleSlug,
      tools,
      model,
      temperature,
      maxIterations,
      userId = 'default-user',
    } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        ok: false,
        error: { message: 'message is required', code: 'INVALID_REQUEST' },
      });
    }

    const coordinator = getCoordinator();

    // Run agent
    const result = await coordinator.run({
      sessionId,
      messages: [{ role: 'user', content: message }],
      mode,
      context: {
        articleSlug,
        userId,
      },
      options: {
        model,
        temperature,
        maxIterations,
      },
    });

    res.json({
      ok: true,
      data: {
        response: result.content,
        sessionId: result.sessionId || sessionId,
        toolsUsed: result.toolCalls?.map(tc => tc.function?.name) || [],
        memoryUpdated: true,
        model: result.model,
        tokens: result.usage,
      },
    });
  } catch (err) {
    console.error('Agent run error:', err);
    res.status(500).json({
      ok: false,
      error: { message: err.message, code: 'INTERNAL_ERROR' },
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
router.post('/stream', async (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event, data) => {
    try {
      if (event) res.write(`event: ${event}\n`);
      if (data !== undefined) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        res.write(`data: ${payload}\n`);
      }
      res.write('\n');
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

  req.on('close', onClose);
  req.on('error', onClose);

  // Keep-alive ping
  const ping = setInterval(() => {
    if (!closed) send('ping', {});
  }, 25000);

  try {
    const {
      message,
      sessionId,
      mode = 'default',
      articleSlug,
      tools,
      model,
      temperature,
      maxIterations,
      userId = 'default-user',
    } = req.body;

    if (!message || typeof message !== 'string') {
      send('error', { message: 'message is required', code: 'INVALID_REQUEST' });
      return onClose();
    }

    send('open', { type: 'open' });

    const coordinator = getCoordinator();

    // Stream agent response
    try {
      for await (const event of coordinator.stream({
        sessionId,
        messages: [{ role: 'user', content: message }],
        mode,
        context: {
          articleSlug,
          userId,
        },
        options: {
          model,
          temperature,
          maxIterations,
        },
      })) {
        if (closed) break;

        switch (event.type) {
          case 'text':
            send('token', { token: event.data });
            break;
          case 'tool_start':
            send('tool_start', { tool: event.data.name, id: event.data.id });
            break;
          case 'tool_end':
            if (event.data.result?.results && Array.isArray(event.data.result.results)) {
              let sources = [];

              if (event.data.name === 'web_search') {
                sources = event.data.result.results.map(r => ({
                  title: r.title || 'Web Result',
                  url: r.url,
                  snippet: r.snippet,
                  score: r.score
                }));
              } else if (event.data.name === 'rag_search') {
                sources = event.data.result.results.map(r => ({
                  title: r.title || r.slug,
                  url: r.slug ? `/posts/${r.slug}` : undefined,
                  snippet: r.content?.slice(0, 150) + '...',
                  score: parseFloat(r.score)
                }));
              }

              if (sources.length > 0) {
                send('sources', { sources });
              }
            }

            send('tool_end', { tool: event.data.name, result: summarizeToolResult(event.data.result) });
            break;
          case 'tool_error':
            send('tool_error', { tool: event.data.name, error: event.data.error });
            break;
          case 'done':
            send('done', {
              type: 'done',
              sessionId,
              toolsUsed: event.data.toolCalls?.map(tc => tc.function?.name) || [],
              content: event.data.content,
            });
            break;
          case 'error':
            send('error', { message: event.data.message });
            break;
        }
      }
    } catch (streamError) {
      send('error', { message: streamError.message, code: 'STREAM_ERROR' });
    }

    onClose();
  } catch (err) {
    console.error('Agent stream error:', err);
    send('error', { message: err.message, code: 'INTERNAL_ERROR' });
    onClose();
  }
});

/**
 * Summarize tool result for streaming (avoid sending too much data)
 */
function summarizeToolResult(result) {
  if (!result) return null;
  if (typeof result === 'string') {
    return result.length > 500 ? result.slice(0, 500) + '...' : result;
  }
  if (Array.isArray(result)) {
    return { count: result.length, preview: result.slice(0, 3) };
  }
  if (typeof result === 'object') {
    const str = JSON.stringify(result);
    if (str.length > 500) {
      return { summary: 'Object with keys: ' + Object.keys(result).join(', ') };
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
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const coordinator = getCoordinator();

    const session = await coordinator.getSession(sessionId);
    if (!session || !session.history || session.history.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Session not found', code: 'NOT_FOUND' },
      });
    }

    res.json({
      ok: true,
      data: {
        sessionId,
        messageCount: session.history?.length || 0,
        metadata: session.metadata,
        // Include last few messages for context
        recentMessages: (session.history || []).slice(-10).map(m => ({
          role: m.role,
          content: typeof m.content === 'string' 
            ? m.content.slice(0, 200) + (m.content.length > 200 ? '...' : '')
            : '[complex content]',
          timestamp: m.timestamp,
        })),
      },
    });
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({
      ok: false,
      error: { message: err.message, code: 'INTERNAL_ERROR' },
    });
  }
});

/**
 * DELETE /session/:sessionId - Clear session
 */
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const coordinator = getCoordinator();

    await coordinator.clearSession(sessionId);

    res.json({
      ok: true,
      data: { deleted: true, sessionId },
    });
  } catch (err) {
    console.error('Delete session error:', err);
    res.status(500).json({
      ok: false,
      error: { message: err.message, code: 'INTERNAL_ERROR' },
    });
  }
});

/**
 * GET /sessions - List all sessions (with pagination)
 */
router.get('/sessions', async (req, res) => {
  try {
    const { userId = 'default-user', limit = 20, offset = 0 } = req.query;
    const sessionMemory = getSessionMemory();

    // Note: In-memory store may not support full listing,
    // this would need persistent store for proper implementation
    const sessions = await sessionMemory.listSessions?.({
      userId,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    }) || [];

    res.json({
      ok: true,
      data: {
        sessions: sessions || [],
        total: sessions?.length || 0,
      },
    });
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({
      ok: false,
      error: { message: err.message, code: 'INTERNAL_ERROR' },
    });
  }
});

// ============================================================================
// UTILITY ENDPOINTS
// ============================================================================

/**
 * GET /health - Agent health check
 */
router.get('/health', async (req, res) => {
  try {
    const coordinator = getCoordinator();
    const health = await coordinator.health();

    res.json({
      ok: health.ok,
      data: {
        status: health.ok ? 'healthy' : 'degraded',
        llm: health.llm,
        tools: health.tools,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Agent health error:', err);
    res.status(500).json({
      ok: false,
      data: {
        status: 'error',
        error: err.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /tools - List available tools
 */
router.get('/tools', async (req, res) => {
  try {
    const coordinator = getCoordinator();
    const health = await coordinator.health();
    const toolNames = health.tools?.names || [];

    res.json({
      ok: true,
      data: {
        tools: toolNames.map(name => ({
          name,
          enabled: true,
        })),
        total: toolNames.length,
      },
    });
  } catch (err) {
    console.error('List tools error:', err);
    res.status(500).json({
      ok: false,
      error: { message: err.message, code: 'INTERNAL_ERROR' },
    });
  }
});

/**
 * GET /modes - List available agent modes
 */
router.get('/modes', (req, res) => {
  res.json({
    ok: true,
    data: {
      modes: [
        { id: 'default', name: 'General', description: 'General conversation and assistance' },
        { id: 'research', name: 'Research', description: 'In-depth information gathering' },
        { id: 'coding', name: 'Coding', description: 'Programming assistance' },
        { id: 'blog', name: 'Blog', description: 'Blog content management' },
        { id: 'article', name: 'Article Q&A', description: 'Questions about specific articles' },
        { id: 'terminal', name: 'Terminal', description: 'System administration tasks' },
      ],
    },
  });
});

// ============================================================================
// MEMORY ENDPOINTS
// ============================================================================

/**
 * POST /memory/extract - Extract memories from conversation
 */
router.post('/memory/extract', async (req, res) => {
  try {
    const { sessionId, messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'messages array is required', code: 'INVALID_REQUEST' },
      });
    }

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
    console.error('Memory extract error:', err);
    res.status(500).json({
      ok: false,
      error: { message: err.message, code: 'INTERNAL_ERROR' },
    });
  }
});

/**
 * POST /memory/search - Search memories semantically
 */
router.post('/memory/search', async (req, res) => {
  try {
    const { query, userId = 'default-user', limit = 10 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        ok: false,
        error: { message: 'query is required', code: 'INVALID_REQUEST' },
      });
    }

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
    console.error('Memory search error:', err);
    res.status(500).json({
      ok: false,
      error: { message: err.message, code: 'INTERNAL_ERROR' },
    });
  }
});

export default router;
