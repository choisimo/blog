// ---------------------------------------------------------------------------
// Streaming utilities for chat — extracted from routes/chat.js
// ---------------------------------------------------------------------------

/**
 * Simple delay helper.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Split text into word-boundary-aware chunks of roughly `preferredSize` chars.
 * @param {string} text
 * @param {number} preferredSize
 * @returns {string[]}
 */
export function splitStreamingText(text, preferredSize) {
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

/**
 * Emit text in streamed chunks via a callback, respecting a close signal.
 * @param {object} options
 * @param {string} options.text
 * @param {function} options.sendChunk
 * @param {function} [options.isClosed]
 * @param {number} [options.chunkSize]
 * @param {number} [options.chunkDelayMs=0]
 * @returns {Promise<string>} The emitted text
 */
export async function emitTextChunks({
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

// ---------------------------------------------------------------------------
// Shared chat-turn helpers — used by both WS and SSE paths in routes/chat.js
// ---------------------------------------------------------------------------

/**
 * Extract a plain-text user message from the `parts` payload.
 * Handles array-of-parts, plain string, or a text fallback.
 * @param {unknown} parts - `payload.parts` (array | string | undefined)
 * @param {string}  [textFallback] - `payload.text` fallback
 * @returns {string}
 */
export function extractUserMessage(parts, textFallback) {
  if (Array.isArray(parts)) {
    return parts
      .filter((p) => p?.type === "text")
      .map((p) => p.text)
      .join("\n");
  }
  if (typeof parts === "string") return parts;
  if (typeof textFallback === "string") return textFallback;
  return "";
}

/**
 * Stream an AI response with automatic non-streaming fallback.
 *
 * 1. Attempt `aiService.streamChat()` — emit chunks via `sendChunk`.
 * 2. If streaming throws **and** no text was emitted yet, fall back to
 *    `aiService.chat()` and emit the result in delayed chunks.
 * 3. Returns the accumulated response text.
 *
 * All transport concerns (WS vs SSE) are abstracted behind the injected
 * `sendChunk` / `isClosed` callbacks.
 *
 * @param {object} opts
 * @param {object} opts.aiService      - AI service instance (streamChat, chat)
 * @param {Array}  opts.messages        - Full message array to send
 * @param {string} opts.model           - Model identifier
 * @param {number} opts.timeout         - Request timeout in ms
 * @param {number} opts.chunkSize       - Preferred chunk size for emitTextChunks
 * @param {number} opts.chunkDelayMs    - Delay between chunks for fallback path
 * @param {function} opts.isClosed      - Returns true when the connection is dead
 * @param {function} opts.sendChunk     - Callback to emit a single text piece
 * @returns {Promise<string>} The accumulated response text
 */
export async function streamWithFallback({
  aiService: ai,
  messages,
  model,
  timeout,
  chunkSize,
  chunkDelayMs,
  isClosed,
  sendChunk,
}) {
  let text = "";

  try {
    for await (const chunk of ai.streamChat(messages, { model, timeout })) {
      const emitted = await emitTextChunks({
        text: chunk,
        chunkSize,
        chunkDelayMs: 0,
        isClosed,
        sendChunk,
      });
      text += emitted;
    }
  } catch (streamErr) {
    if (!text) {
      // Streaming produced nothing — try non-streaming fallback
      const fallback = await ai.chat(messages, { model, timeout });
      const fallbackText = fallback.content || "";
      if (!isClosed() && fallbackText) {
        text += await emitTextChunks({
          text: fallbackText,
          chunkSize,
          chunkDelayMs,
          isClosed,
          sendChunk,
        });
      }
    } else {
      // Partial text was already emitted — don't silently swallow
      throw streamErr;
    }
  }

  return text;
}

/**
 * Finalize a chat turn: store the assistant message, reinforce the notebook,
 * and fire a session notification.
 *
 * @param {object} opts
 * @param {object} opts.session                 - In-memory session object
 * @param {string} opts.sessionId               - Session identifier
 * @param {string} opts.userMessage             - Original user text (for notebook)
 * @param {string} opts.text                    - Assistant response text
 * @param {function} opts.reinforceSessionNotebook - Async notebook reinforcement fn
 * @param {function} opts.notifySession          - Session notification fn
 */
export function finalizeChatTurn({
  session,
  sessionId,
  userMessage,
  text,
  reinforceSessionNotebook,
  notifySession,
}) {
  session.lastActivityAt = Date.now();
  session.messages.push({ role: "assistant", content: text });
  void reinforceSessionNotebook(session, userMessage, text);
  notifySession(sessionId, {
    level: "info",
    message: "AI response completed",
  });
}
