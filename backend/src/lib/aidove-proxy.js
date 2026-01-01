/**
 * Aidove Webhook Proxy - OpenAI Compatible Wrapper
 *
 * Converts OpenAI-compatible requests to Aidove webhook format,
 * enabling external services to route requests through n8n/Aidove workflows.
 *
 * Architecture:
 *   External Service -> Aidove Proxy (this) -> n8n Webhook -> AI Agent/RAG Pipeline
 *
 * Supported Models & Webhooks:
 *   - aidove      : Basic chatbot (AIDOVE_WEBHOOK_URL)
 *   - aidove-rag  : RAG pipeline with vector search (AIDOVE_RAG_WEBHOOK_URL)
 *
 * Aidove Webhook Format:
 *   Request:  { chatInput: string, sessionId?: string, metadata?: object }
 *   Response: { output: string, sources?: string[] } or streaming SSE
 *
 * This proxy exposes OpenAI-compatible endpoints:
 *   POST /v1/chat/completions
 *   POST /v1/completions
 *   GET  /v1/models
 *   GET  /health
 *
 * Usage:
 *   import { createAidoveProxy } from './lib/aidove-proxy.js';
 *   const proxy = createAidoveProxy({ webhookUrl: 'https://...' });
 *   app.use('/aidove', proxy);
 *
 * Environment Variables:
 *   AIDOVE_WEBHOOK_URL      - n8n webhook URL for basic chatbot (required)
 *   AIDOVE_RAG_WEBHOOK_URL  - n8n webhook URL for RAG pipeline (optional)
 *   AIDOVE_WEBHOOK_TIMEOUT  - Request timeout in ms (default: 120000)
 *   AIDOVE_API_KEY          - Optional API key for webhook auth
 */

import { Router } from 'express';
import { randomUUID } from 'crypto';

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_TIMEOUT = 120000; // 2 minutes
const STREAM_CHUNK_DELAY = 50; // ms between stream chunks

/**
 * Model to webhook URL mapping
 */
function getWebhookUrlForModel(model, config) {
  const modelLower = (model || '').toLowerCase();
  
  // RAG models use dedicated RAG webhook
  if (modelLower.includes('rag') || modelLower.includes('search')) {
    return config.ragWebhookUrl || config.webhookUrl;
  }
  
  // Default to basic chatbot webhook
  return config.webhookUrl;
}

/**
 * Logger for Aidove Proxy
 */
const logger = {
  _format(level, context, message, data = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'aidove-proxy',
      ...context,
      message,
      ...data,
    });
  },
  info(ctx, msg, data) { console.log(this._format('info', ctx, msg, data)); },
  warn(ctx, msg, data) { console.warn(this._format('warn', ctx, msg, data)); },
  error(ctx, msg, data) { console.error(this._format('error', ctx, msg, data)); },
  debug(ctx, msg, data) {
    if (process.env.DEBUG_AIDOVE === 'true') {
      console.debug(this._format('debug', ctx, msg, data));
    }
  },
};

// =============================================================================
// Aidove Webhook Client
// =============================================================================

/**
 * Call Aidove webhook with converted request
 */
async function callAidoveWebhook(webhookUrl, payload, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeout || DEFAULT_TIMEOUT
  );

  const headers = {
    'Content-Type': 'application/json',
  };

  // Add API key if configured
  if (options.apiKey) {
    headers['Authorization'] = `Bearer ${options.apiKey}`;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Aidove webhook error: ${response.status} ${errorText}`);
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Convert OpenAI messages to Aidove chatInput format
 */
function messagesToChatInput(messages) {
  if (!messages || messages.length === 0) {
    return '';
  }

  // For simple single-user message, return content directly
  if (messages.length === 1 && messages[0].role === 'user') {
    return messages[0].content;
  }

  // For multi-turn conversation, format as readable text
  return messages.map(msg => {
    const role = msg.role === 'assistant' ? 'Assistant' :
                 msg.role === 'system' ? 'System' : 'User';
    return `${role}: ${msg.content}`;
  }).join('\n\n');
}

/**
 * Generate OpenAI-compatible response format
 */
function createOpenAIResponse(content, model, requestId, extra = {}) {
  const now = Math.floor(Date.now() / 1000);
  
  const response = {
    id: `chatcmpl-${requestId}`,
    object: 'chat.completion',
    created: now,
    model: model || 'aidove',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: content,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 0, // Aidove doesn't provide token counts
      completion_tokens: 0,
      total_tokens: 0,
    },
  };

  // Add sources if available (for RAG responses)
  if (extra.sources && Array.isArray(extra.sources)) {
    response.sources = extra.sources;
  }

  return response;
}

/**
 * Generate OpenAI-compatible streaming chunk
 */
function createStreamChunk(content, model, requestId, isFirst = false, isDone = false) {
  const now = Math.floor(Date.now() / 1000);
  
  if (isDone) {
    return {
      id: `chatcmpl-${requestId}`,
      object: 'chat.completion.chunk',
      created: now,
      model: model || 'aidove',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop',
        },
      ],
    };
  }

  return {
    id: `chatcmpl-${requestId}`,
    object: 'chat.completion.chunk',
    created: now,
    model: model || 'aidove',
    choices: [
      {
        index: 0,
        delta: isFirst
          ? { role: 'assistant', content }
          : { content },
        finish_reason: null,
      },
    ],
  };
}

// =============================================================================
// Express Router Factory
// =============================================================================

/**
 * Create Aidove proxy router
 *
 * @param {object} options
 * @param {string} options.webhookUrl - Aidove webhook URL (basic chatbot)
 * @param {string} options.ragWebhookUrl - Aidove RAG webhook URL (optional)
 * @param {string} options.apiKey - Optional API key
 * @param {number} options.timeout - Request timeout in ms
 * @returns {Router}
 */
export function createAidoveProxy(options = {}) {
  const router = Router();
  
  const config = {
    webhookUrl: options.webhookUrl || process.env.AIDOVE_WEBHOOK_URL,
    ragWebhookUrl: options.ragWebhookUrl || process.env.AIDOVE_RAG_WEBHOOK_URL,
    apiKey: options.apiKey || process.env.AIDOVE_API_KEY,
    timeout: options.timeout || parseInt(process.env.AIDOVE_WEBHOOK_TIMEOUT) || DEFAULT_TIMEOUT,
  };

  if (!config.webhookUrl) {
    logger.warn({}, 'AIDOVE_WEBHOOK_URL not configured - proxy will return errors');
  }

  if (!config.ragWebhookUrl) {
    logger.info({}, 'AIDOVE_RAG_WEBHOOK_URL not configured - RAG requests will use basic webhook');
  }

  // ---------------------------------------------------------------------------
  // Health Check
  // ---------------------------------------------------------------------------
  router.get('/health', (req, res) => {
    res.json({
      status: config.webhookUrl ? 'ok' : 'not_configured',
      provider: 'aidove',
      endpoints: {
        basic: config.webhookUrl ? 'configured' : null,
        rag: config.ragWebhookUrl ? 'configured' : null,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // List Models
  // ---------------------------------------------------------------------------
  router.get('/v1/models', (req, res) => {
    const models = [
      {
        id: 'aidove',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'aidove',
        permission: [],
        root: 'aidove',
        parent: null,
        description: 'Basic chatbot via n8n webhook',
      },
    ];

    // Only list RAG model if RAG webhook is configured
    if (config.ragWebhookUrl) {
      models.push({
        id: 'aidove-rag',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'aidove',
        permission: [],
        root: 'aidove-rag',
        parent: null,
        description: 'RAG pipeline with vector search via n8n webhook',
      });
    }

    res.json({
      object: 'list',
      data: models,
    });
  });

  // ---------------------------------------------------------------------------
  // Chat Completions (OpenAI-compatible)
  // ---------------------------------------------------------------------------
  router.post('/v1/chat/completions', async (req, res) => {
    const requestId = randomUUID().slice(0, 8);
    const startTime = Date.now();

    const { messages, model, stream, temperature, max_tokens } = req.body;

    // Determine which webhook to use based on model
    const webhookUrl = getWebhookUrlForModel(model, config);

    if (!webhookUrl) {
      return res.status(503).json({
        error: {
          message: 'Aidove webhook URL not configured',
          type: 'service_unavailable',
          code: 'aidove_not_configured',
        },
      });
    }

    const isRagRequest = webhookUrl === config.ragWebhookUrl;

    logger.debug(
      { operation: 'chat', requestId },
      'Received chat request',
      { model, messageCount: messages?.length, stream, isRag: isRagRequest }
    );

    try {
      // Convert OpenAI format to Aidove format
      const chatInput = messagesToChatInput(messages);
      
      // Extract session ID from metadata or generate new one
      const sessionId = req.body.user || req.headers['x-session-id'] || requestId;

      const aidovePayload = {
        chatInput,
        sessionId,
        metadata: {
          model,
          temperature,
          max_tokens,
          requestId,
          timestamp: new Date().toISOString(),
          // RAG-specific metadata
          ...(isRagRequest && {
            collection: req.body.collection || 'blog-posts-all-MiniLM-L6-v2',
            topK: req.body.topK || 5,
          }),
        },
      };

      logger.debug(
        { operation: 'chat', requestId },
        `Calling Aidove ${isRagRequest ? 'RAG' : 'basic'} webhook`,
        { sessionId, inputLength: chatInput.length, webhookUrl: webhookUrl.replace(/\/webhook\/.*$/, '/webhook/***') }
      );

      const response = await callAidoveWebhook(webhookUrl, aidovePayload, {
        apiKey: config.apiKey,
        timeout: config.timeout,
      });

      // Handle streaming response
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Check if Aidove returns SSE stream
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('text/event-stream')) {
          // Pass through SSE stream from Aidove (if supported)
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let isFirst = true;

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const text = decoder.decode(value, { stream: true });
              // Parse Aidove SSE and convert to OpenAI format
              const lines = text.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const content = data.output || data.content || data.text || '';
                    if (content) {
                      const chunk = createStreamChunk(content, model, requestId, isFirst);
                      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                      isFirst = false;
                    }
                  } catch {
                    // Raw text chunk
                    const content = line.slice(6);
                    if (content && content !== '[DONE]') {
                      const chunk = createStreamChunk(content, model, requestId, isFirst);
                      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                      isFirst = false;
                    }
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        } else {
          // Non-streaming response from Aidove - simulate streaming
          const data = await response.json();
          const content = data.output || data.response || data.text || JSON.stringify(data);

          // Send content in chunks to simulate streaming
          const chunkSize = 20;
          let isFirst = true;

          for (let i = 0; i < content.length; i += chunkSize) {
            const chunkContent = content.slice(i, Math.min(i + chunkSize, content.length));
            const chunk = createStreamChunk(chunkContent, model, requestId, isFirst);
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            isFirst = false;
            
            // Small delay between chunks
            await new Promise(r => setTimeout(r, STREAM_CHUNK_DELAY));
          }
        }

        // Send final chunk
        const finalChunk = createStreamChunk('', model, requestId, false, true);
        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();

      } else {
        // Non-streaming response
        const data = await response.json();
        const content = data.output || data.response || data.text || JSON.stringify(data);

        const duration = Date.now() - startTime;
        logger.info(
          { operation: 'chat', requestId },
          'Chat completed',
          { duration, responseLength: content.length, isRag: isRagRequest }
        );

        res.json(createOpenAIResponse(content, model, requestId, {
          sources: data.sources, // Pass through RAG sources if available
        }));
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        { operation: 'chat', requestId },
        'Chat failed',
        { duration, error: error.message }
      );

      // Return OpenAI-compatible error
      res.status(500).json({
        error: {
          message: error.message,
          type: 'server_error',
          code: 'aidove_error',
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Legacy Completions (for compatibility)
  // ---------------------------------------------------------------------------
  router.post('/v1/completions', async (req, res) => {
    const { prompt, model, stream } = req.body;

    // Convert to chat format and forward
    req.body = {
      ...req.body,
      messages: [{ role: 'user', content: prompt }],
    };

    // Reuse chat completions handler
    return router.handle(req, res);
  });

  return router;
}

// =============================================================================
// Standalone Server (for running as separate service)
// =============================================================================

/**
 * Start Aidove proxy as standalone server
 * 
 * Usage: node aidove-proxy.js
 * 
 * Environment:
 *   AIDOVE_PROXY_PORT      - Server port (default: 4001)
 *   AIDOVE_WEBHOOK_URL     - n8n webhook URL (basic chatbot)
 *   AIDOVE_RAG_WEBHOOK_URL - n8n webhook URL (RAG pipeline)
 */
export async function startStandaloneServer(port = null) {
  const express = (await import('express')).default;
  const app = express();
  
  app.use(express.json({ limit: '10mb' }));
  
  const proxy = createAidoveProxy();
  app.use('/', proxy);

  const serverPort = port || parseInt(process.env.AIDOVE_PROXY_PORT) || 4001;
  
  app.listen(serverPort, () => {
    logger.info({}, `Aidove proxy server started on port ${serverPort}`);
    logger.info({}, `Basic webhook: ${process.env.AIDOVE_WEBHOOK_URL || 'NOT CONFIGURED'}`);
    logger.info({}, `RAG webhook: ${process.env.AIDOVE_RAG_WEBHOOK_URL || 'NOT CONFIGURED (using basic)'}`);
  });
}

// Run standalone if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startStandaloneServer();
}

export default createAidoveProxy;
