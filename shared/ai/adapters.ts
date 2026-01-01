/**
 * AI Provider Adapters
 * 
 * Provider별 응답 형식 차이를 추상화하여 통일된 인터페이스를 제공합니다.
 * 하드코딩된 MESSAGE_PATHS 배열 대신 Adapter Pattern을 사용합니다.
 * 
 * 원칙:
 * 1. 새 Provider 추가 시 Adapter만 구현하면 됨
 * 2. 기존 코드 수정 없이 Provider 확장 가능
 * 3. Provider별 특수 처리 로직 캡슐화
 */

// ============================================================================
// Types
// ============================================================================

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIResponse {
  content: string;
  model: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  raw?: unknown; // Original response for debugging
}

export interface ProviderAdapter {
  name: string;
  
  /** Transform request to provider-specific format */
  formatRequest(request: AIRequest): unknown;
  
  /** Parse provider response to unified format */
  parseResponse(response: unknown): AIResponse;
  
  /** Parse streaming chunk */
  parseStreamChunk(chunk: unknown): string | null;
  
  /** Extract error message from provider error response */
  parseError(error: unknown): string;
}

// ============================================================================
// OpenAI Adapter (also works for n8n OpenAI-compatible responses, Azure OpenAI)
// ============================================================================

export const OpenAIAdapter: ProviderAdapter = {
  name: 'openai',
  
  formatRequest(request: AIRequest) {
    return {
      model: request.model || 'gpt-4',
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stream: request.stream ?? false,
    };
  },
  
  parseResponse(response: unknown): AIResponse {
    const r = response as {
      choices?: Array<{
        message?: { content?: string };
        finish_reason?: string;
      }>;
      model?: string;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    
    return {
      content: r.choices?.[0]?.message?.content || '',
      model: r.model || 'unknown',
      finishReason: r.choices?.[0]?.finish_reason,
      usage: r.usage ? {
        promptTokens: r.usage.prompt_tokens || 0,
        completionTokens: r.usage.completion_tokens || 0,
        totalTokens: r.usage.total_tokens || 0,
      } : undefined,
      raw: response,
    };
  },
  
  parseStreamChunk(chunk: unknown): string | null {
    const c = chunk as {
      choices?: Array<{
        delta?: { content?: string };
      }>;
    };
    return c.choices?.[0]?.delta?.content || null;
  },
  
  parseError(error: unknown): string {
    const e = error as { error?: { message?: string }; message?: string };
    return e.error?.message || e.message || 'Unknown OpenAI error';
  },
};

// ============================================================================
// Anthropic (Claude) Adapter
// ============================================================================

export const AnthropicAdapter: ProviderAdapter = {
  name: 'anthropic',
  
  formatRequest(request: AIRequest) {
    // Anthropic uses different message format
    const systemMessage = request.messages.find(m => m.role === 'system');
    const otherMessages = request.messages.filter(m => m.role !== 'system');
    
    return {
      model: request.model || 'claude-3-sonnet-20240229',
      max_tokens: request.maxTokens || 4096,
      system: systemMessage?.content,
      messages: otherMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };
  },
  
  parseResponse(response: unknown): AIResponse {
    const r = response as {
      content?: Array<{ type?: string; text?: string }>;
      model?: string;
      stop_reason?: string;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
    };
    
    // Anthropic returns content as array of blocks
    const textContent = r.content
      ?.filter(c => c.type === 'text')
      .map(c => c.text)
      .join('') || '';
    
    return {
      content: textContent,
      model: r.model || 'unknown',
      finishReason: r.stop_reason,
      usage: r.usage ? {
        promptTokens: r.usage.input_tokens || 0,
        completionTokens: r.usage.output_tokens || 0,
        totalTokens: (r.usage.input_tokens || 0) + (r.usage.output_tokens || 0),
      } : undefined,
      raw: response,
    };
  },
  
  parseStreamChunk(chunk: unknown): string | null {
    const c = chunk as {
      type?: string;
      delta?: { type?: string; text?: string };
    };
    if (c.type === 'content_block_delta' && c.delta?.type === 'text_delta') {
      return c.delta.text || null;
    }
    return null;
  },
  
  parseError(error: unknown): string {
    const e = error as { error?: { message?: string }; message?: string };
    return e.error?.message || e.message || 'Unknown Anthropic error';
  },
};

// ============================================================================
// Google Gemini Adapter
// ============================================================================

export const GeminiAdapter: ProviderAdapter = {
  name: 'gemini',
  
  formatRequest(request: AIRequest) {
    return {
      contents: request.messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens,
      },
    };
  },
  
  parseResponse(response: unknown): AIResponse {
    const r = response as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };
    
    const content = r.candidates?.[0]?.content?.parts
      ?.map(p => p.text)
      .join('') || '';
    
    return {
      content,
      model: 'gemini',
      finishReason: r.candidates?.[0]?.finishReason,
      usage: r.usageMetadata ? {
        promptTokens: r.usageMetadata.promptTokenCount || 0,
        completionTokens: r.usageMetadata.candidatesTokenCount || 0,
        totalTokens: r.usageMetadata.totalTokenCount || 0,
      } : undefined,
      raw: response,
    };
  },
  
  parseStreamChunk(chunk: unknown): string | null {
    const c = chunk as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    return c.candidates?.[0]?.content?.parts?.[0]?.text || null;
  },
  
  parseError(error: unknown): string {
    const e = error as { error?: { message?: string }; message?: string };
    return e.error?.message || e.message || 'Unknown Gemini error';
  },
};

// ============================================================================
// VAS (OpenCode) Adapter - Legacy format support
// ============================================================================

export const VASAdapter: ProviderAdapter = {
  name: 'vas',
  
  formatRequest(request: AIRequest) {
    // VAS uses a simplified format
    const lastUserMessage = request.messages
      .filter(m => m.role === 'user')
      .pop();
    
    return {
      message: lastUserMessage?.content || '',
      providerID: 'github-copilot',
      modelID: request.model || 'gpt-4.1',
      title: `api-${Date.now()}`,
    };
  },
  
  parseResponse(response: unknown): AIResponse {
    // VAS can return in multiple formats - handle all of them
    const r = response as Record<string, unknown>;
    
    // Try different response paths (replacing hardcoded MESSAGE_PATHS)
    const content = extractContent(r, [
      ['response', 'text'],
      ['response', 'content'],
      ['data', 'response', 'text'],
      ['data', 'message'],
      ['message'],
      ['content'],
      ['text'],
      ['result'],
    ]);
    
    return {
      content: content || '',
      model: (r.model as string) || 'vas',
      raw: response,
    };
  },
  
  parseStreamChunk(chunk: unknown): string | null {
    const c = chunk as { text?: string; content?: string; delta?: string };
    return c.text || c.content || c.delta || null;
  },
  
  parseError(error: unknown): string {
    const e = error as { error?: string; message?: string };
    return e.error || e.message || 'Unknown VAS error';
  },
};

// ============================================================================
// Universal Response Extractor
// ============================================================================

/**
 * Extract content from nested object using multiple possible paths
 * This replaces the hardcoded MESSAGE_PATHS array
 */
function extractContent(
  obj: Record<string, unknown>,
  paths: string[][]
): string | null {
  for (const path of paths) {
    let current: unknown = obj;
    
    for (const key of path) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        current = undefined;
        break;
      }
    }
    
    if (typeof current === 'string' && current.length > 0) {
      return current;
    }
  }
  
  return null;
}

// ============================================================================
// Provider Registry
// ============================================================================

const adapters: Map<string, ProviderAdapter> = new Map([
  ['openai', OpenAIAdapter],
  ['n8n', OpenAIAdapter],     // n8n uses OpenAI format
  ['azure', OpenAIAdapter],   // Azure OpenAI uses same format
  ['anthropic', AnthropicAdapter],
  ['claude', AnthropicAdapter],
  ['gemini', GeminiAdapter],
  ['google', GeminiAdapter],
  ['vas', VASAdapter],
  ['github-copilot', VASAdapter],
]);

/**
 * Get adapter for a provider
 */
export function getAdapter(provider: string): ProviderAdapter {
  const adapter = adapters.get(provider.toLowerCase());
  if (!adapter) {
    // Default to OpenAI adapter (most common format)
    console.warn(`Unknown provider "${provider}", using OpenAI adapter`);
    return OpenAIAdapter;
  }
  return adapter;
}

/**
 * Register a custom adapter
 */
export function registerAdapter(name: string, adapter: ProviderAdapter): void {
  adapters.set(name.toLowerCase(), adapter);
}

/**
 * List all registered adapters
 */
export function listAdapters(): string[] {
  return Array.from(adapters.keys());
}

// ============================================================================
// Unified AI Client using Adapters
// ============================================================================

export interface UnifiedAIClientOptions {
  baseUrl: string;
  apiKey: string;
  provider?: string;
  defaultModel?: string;
}

export class UnifiedAIClient {
  private baseUrl: string;
  private apiKey: string;
  private adapter: ProviderAdapter;
  private defaultModel: string;
  
  constructor(options: UnifiedAIClientOptions) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
    this.adapter = getAdapter(options.provider || 'openai');
    this.defaultModel = options.defaultModel || 'gpt-4';
  }
  
  async chat(request: AIRequest): Promise<AIResponse> {
    const formattedRequest = this.adapter.formatRequest({
      ...request,
      model: request.model || this.defaultModel,
    });
    
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(formattedRequest),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(this.adapter.parseError(error));
    }
    
    const data = await response.json();
    return this.adapter.parseResponse(data);
  }
  
  async *stream(request: AIRequest): AsyncGenerator<string, void, unknown> {
    const formattedRequest = this.adapter.formatRequest({
      ...request,
      model: request.model || this.defaultModel,
      stream: true,
    });
    
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(formattedRequest),
    });
    
    if (!response.ok || !response.body) {
      const error = await response.json().catch(() => ({}));
      throw new Error(this.adapter.parseError(error));
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              const content = this.adapter.parseStreamChunk(parsed);
              if (content) yield content;
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
