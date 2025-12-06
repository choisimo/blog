/**
 * Virtual Agent Service (VAS) Client
 *
 * All LLM calls are routed through the VAS stack:
 *   - vas-core (port 7012): Core OpenCode engine
 *   - vas-proxy (port 7016): Simplified /auto-chat endpoint
 *   - vas-admin (port 7080): Token management
 *
 * Architecture:
 *   Backend API -> vas-proxy:7016/auto-chat -> vas-core:7012 -> LLM Provider
 *
 * Usage:
 *   const vas = new VASClient();
 *   const response = await vas.chat([{ role: 'user', content: 'Hello!' }]);
 *   // or
 *   const text = await vas.generate('Summarize this text...');
 */

import { config } from '../config.js';

// Default configuration - points to vas-proxy
const AI_SERVE_BASE_URL = process.env.AI_SERVE_BASE_URL || 'http://vas-proxy:7016';
const VAS_CORE_URL = process.env.VAS_CORE_URL || 'http://vas-core:7012';
const AI_SERVE_DEFAULT_PROVIDER = process.env.AI_SERVE_DEFAULT_PROVIDER || 'github-copilot';
const AI_SERVE_DEFAULT_MODEL = process.env.AI_SERVE_DEFAULT_MODEL || 'gpt-4.1';

/**
 * Virtual Agent Service (VAS) API Client
 */
export class VASClient {
  constructor(options = {}) {
    // vas-proxy URL for simplified chat
    this.baseUrl = options.baseUrl || AI_SERVE_BASE_URL;
    // Direct vas-core URL for advanced operations
    this.vasCoreUrl = options.vasCoreUrl || VAS_CORE_URL;
    this.defaultProvider = options.provider || AI_SERVE_DEFAULT_PROVIDER;
    this.defaultModel = options.model || AI_SERVE_DEFAULT_MODEL;
  }

  /**
   * Simple text generation via vas-proxy
   * @param {string} prompt - The prompt text
   * @param {object} options - Options (provider, model)
   * @returns {Promise<string>} Generated text
   */
  async generate(prompt, options = {}) {
    const provider = options.provider || this.defaultProvider;
    const model = options.model || this.defaultModel;

    const response = await fetch(`${this.baseUrl}/auto-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        providerID: provider,
        modelID: model,
        title: `backend-generate-${Date.now()}`,
      }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => '');
      throw new Error(`AI generation failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    return data.response?.text || '';
  }

  /**
   * Chat completion with message history via vas-proxy
   * @param {Array<{role: string, content: string}>} messages - Chat messages
   * @param {object} options - Options (provider, model)
   * @returns {Promise<{content: string, model: string, provider: string}>}
   */
  async chat(messages, options = {}) {
    const provider = options.provider || this.defaultProvider;
    const model = options.model || this.defaultModel;

    // For chat with history, format messages into a single prompt
    // vas-proxy creates a new session per request
    let prompt;
    if (messages.length === 1) {
      prompt = messages[0].content;
    } else {
      // Format conversation history
      const formatted = messages.map((m) => {
        const role = m.role === 'assistant' ? 'Assistant' : 'User';
        return `${role}: ${m.content}`;
      }).join('\n\n');
      prompt = formatted;
    }

    const response = await fetch(`${this.baseUrl}/auto-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        providerID: provider,
        modelID: model,
        title: `backend-chat-${Date.now()}`,
      }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => '');
      throw new Error(`AI chat failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    return {
      content: data.response?.text || '',
      model,
      provider,
      sessionId: data.sessionId,
    };
  }

  /**
   * Vision analysis with image
   * @param {string} imageBase64 - Base64 encoded image
   * @param {string} mimeType - Image MIME type
   * @param {string} prompt - Analysis prompt
   * @param {object} options - Options
   * @returns {Promise<string>} Analysis result
   */
  async vision(imageBase64, mimeType, prompt, options = {}) {
    // Include image as data URL in the message
    const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;
    const fullPrompt = `[Image: ${imageDataUrl}]\n\n${prompt}`;

    // Use vision-capable model
    return this.generate(fullPrompt, {
      ...options,
      model: options.model || 'gpt-4o',
    });
  }

  /**
   * Health check - checks vas-proxy health
   * @returns {Promise<{ok: boolean, status: object}>}
   */
  async health() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) {
        return { ok: false, error: `Status ${response.status}` };
      }
      const data = await response.json();
      return {
        ok: data.status === 'ok' && data.tokenReady,
        status: data,
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Status check - gets detailed status from vas-proxy
   * @returns {Promise<{ok: boolean, status: object}>}
   */
  async status() {
    try {
      const response = await fetch(`${this.baseUrl}/status`);
      if (!response.ok) {
        return { ok: false, error: `Status ${response.status}` };
      }
      const data = await response.json();
      return { ok: true, status: data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Get available providers from vas-core directly
   * @returns {Promise<{providers: Array}>}
   */
  async providers() {
    const response = await fetch(`${this.vasCoreUrl}/config/providers`);
    if (!response.ok) {
      throw new Error(`Failed to get providers: ${response.status}`);
    }
    return response.json();
  }
}

// Legacy alias for backward compatibility
export const AIServeClient = VASClient;

// Singleton instance
let _client = null;

/**
 * Get the default VAS client instance
 * @returns {VASClient}
 */
export function getVASClient() {
  if (!_client) {
    _client = new VASClient();
  }
  return _client;
}

// Legacy alias for backward compatibility
export const getAIServeClient = getVASClient;

/**
 * Legacy compatibility: generateContent function
 * Drop-in replacement for the old Gemini generateContent
 *
 * @param {string} prompt - The prompt text
 * @param {object} options - Options (temperature is noted but not directly used)
 * @returns {Promise<string>} Generated text
 */
export async function generateContent(prompt, options = {}) {
  const client = getVASClient();
  return client.generate(prompt, options);
}

/**
 * Legacy compatibility: tryParseJson function
 * Attempts to parse JSON from AI response text
 */
export function tryParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // empty
  }
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      // empty
    }
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const maybe = text.slice(start, end + 1);
    try {
      return JSON.parse(maybe);
    } catch {
      // empty
    }
  }
  return null;
}

export default VASClient;
