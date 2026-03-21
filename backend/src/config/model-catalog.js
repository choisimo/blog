/**
 * Central AI model catalog.
 *
 * This module is the single source of truth for model identifiers,
 * static capability metadata, fallback chains, and static UI fallback options.
 */

export const MODEL_IDS = Object.freeze({
  GPT_5_2: "gpt-5.2",
  GPT_5_4: "gpt-5.4",
  GPT_5_MINI: "gpt-5-mini",
  GPT_4_1: "gpt-4.1",
  GPT_4_1_MINI: "gpt-4.1-mini",
  GPT_4O: "gpt-4o",
  GPT_4O_MINI: "gpt-4o-mini",
  GPT_4_TURBO: "gpt-4-turbo",
  GPT_4: "gpt-4",
  GPT_3_5_TURBO: "gpt-3.5-turbo",
  CLAUDE_3_5_SONNET_20241022: "claude-3-5-sonnet-20241022",
  CLAUDE_3_OPUS_20240229: "claude-3-opus-20240229",
  CLAUDE_3_SONNET_20240229: "claude-3-sonnet-20240229",
  CLAUDE_3_HAIKU_20240307: "claude-3-haiku-20240307",
  CLAUDE_SONNET_4: "claude-sonnet-4",
  CLAUDE_3_5_SONNET: "claude-3.5-sonnet",
  GEMINI_2_0_FLASH: "gemini-2.0-flash",
});

export const EMBEDDING_MODEL_IDS = Object.freeze({
  TEXT_EMBEDDING_3_SMALL: "text-embedding-3-small",
  TEXT_EMBEDDING_3_LARGE: "text-embedding-3-large",
  TEXT_EMBEDDING_ADA_002: "text-embedding-ada-002",
  QWEN3_EMBEDDING_8B: "qwen3-embedding-8b",
  MULTILINGUAL_E5_LARGE: "multilingual-e5-large",
});

export const SYSTEM_MODEL_DEFAULTS = Object.freeze({
  DEFAULT: MODEL_IDS.GPT_5_MINI,
  AGENT: MODEL_IDS.GPT_4_1,
  VISION: MODEL_IDS.GPT_5_4,
  EMBEDDING: EMBEDDING_MODEL_IDS.QWEN3_EMBEDDING_8B,
  QUERY_EXPANDER: MODEL_IDS.GPT_4_1_MINI,
});

export const DEFAULT_MODEL_CAPABILITIES = Object.freeze({
  vision: false,
  streaming: true,
  functionCalling: false,
  contextWindow: 4096,
});

export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

export const MODEL_CAPABILITY_CATALOG = Object.freeze({
  [MODEL_IDS.GPT_4O]: Object.freeze({
    vision: true,
    streaming: true,
    functionCalling: true,
    contextWindow: 128000,
  }),
  [MODEL_IDS.GPT_4O_MINI]: Object.freeze({
    vision: true,
    streaming: true,
    functionCalling: true,
    contextWindow: 128000,
  }),
  [MODEL_IDS.GPT_4_TURBO]: Object.freeze({
    vision: true,
    streaming: true,
    functionCalling: true,
    contextWindow: 128000,
  }),
  [MODEL_IDS.GPT_4]: Object.freeze({
    vision: false,
    streaming: true,
    functionCalling: true,
    contextWindow: 8192,
  }),
  [MODEL_IDS.GPT_3_5_TURBO]: Object.freeze({
    vision: false,
    streaming: true,
    functionCalling: true,
    contextWindow: 16385,
  }),
  [MODEL_IDS.CLAUDE_3_5_SONNET_20241022]: Object.freeze({
    vision: true,
    streaming: true,
    functionCalling: true,
    contextWindow: 200000,
  }),
  [MODEL_IDS.CLAUDE_3_OPUS_20240229]: Object.freeze({
    vision: true,
    streaming: true,
    functionCalling: true,
    contextWindow: 200000,
  }),
  [MODEL_IDS.CLAUDE_3_SONNET_20240229]: Object.freeze({
    vision: true,
    streaming: true,
    functionCalling: true,
    contextWindow: 200000,
  }),
  [MODEL_IDS.CLAUDE_3_HAIKU_20240307]: Object.freeze({
    vision: true,
    streaming: true,
    functionCalling: true,
    contextWindow: 200000,
  }),
});

export const MODEL_FALLBACK_CATALOG = Object.freeze({
  [MODEL_IDS.GPT_4O]: Object.freeze([
    MODEL_IDS.GPT_4O_MINI,
    MODEL_IDS.GPT_4_TURBO,
    MODEL_IDS.GPT_3_5_TURBO,
  ]),
  [MODEL_IDS.GPT_4O_MINI]: Object.freeze([MODEL_IDS.GPT_3_5_TURBO]),
  [MODEL_IDS.GPT_4_TURBO]: Object.freeze([
    MODEL_IDS.GPT_4O_MINI,
    MODEL_IDS.GPT_4,
    MODEL_IDS.GPT_3_5_TURBO,
  ]),
  [MODEL_IDS.GPT_4]: Object.freeze([
    MODEL_IDS.GPT_4O_MINI,
    MODEL_IDS.GPT_3_5_TURBO,
  ]),
  [MODEL_IDS.CLAUDE_3_5_SONNET_20241022]: Object.freeze([
    MODEL_IDS.CLAUDE_3_SONNET_20240229,
    MODEL_IDS.CLAUDE_3_HAIKU_20240307,
  ]),
  [MODEL_IDS.CLAUDE_3_OPUS_20240229]: Object.freeze([
    MODEL_IDS.CLAUDE_3_5_SONNET_20241022,
    MODEL_IDS.CLAUDE_3_SONNET_20240229,
  ]),
});

export const EMBEDDING_MODEL_CATALOG = Object.freeze({
  [EMBEDDING_MODEL_IDS.TEXT_EMBEDDING_3_SMALL]: Object.freeze({
    dimensions: 1536,
  }),
  [EMBEDDING_MODEL_IDS.TEXT_EMBEDDING_3_LARGE]: Object.freeze({
    dimensions: 3072,
  }),
  [EMBEDDING_MODEL_IDS.TEXT_EMBEDDING_ADA_002]: Object.freeze({
    dimensions: 1536,
  }),
});

export const STATIC_MODEL_FALLBACK_LIST = Object.freeze([
  Object.freeze({
    id: MODEL_IDS.GPT_4_1,
    name: "GPT-4.1",
    provider: "GitHub",
    capabilities: Object.freeze(["chat", "vision"]),
  }),
  Object.freeze({
    id: MODEL_IDS.GPT_4O,
    name: "GPT-4o",
    provider: "GitHub",
    capabilities: Object.freeze(["chat", "vision"]),
  }),
  Object.freeze({
    id: MODEL_IDS.GPT_4O_MINI,
    name: "GPT-4o Mini",
    provider: "GitHub",
    capabilities: Object.freeze(["chat", "vision"]),
  }),
  Object.freeze({
    id: MODEL_IDS.CLAUDE_SONNET_4,
    name: "Claude Sonnet 4",
    provider: "GitHub",
    capabilities: Object.freeze(["chat", "vision", "long-context"]),
  }),
  Object.freeze({
    id: MODEL_IDS.CLAUDE_3_5_SONNET,
    name: "Claude 3.5 Sonnet",
    provider: "GitHub",
    capabilities: Object.freeze(["chat", "vision"]),
  }),
  Object.freeze({
    id: MODEL_IDS.GEMINI_2_0_FLASH,
    name: "Gemini 2.0 Flash",
    provider: "GitHub",
    capabilities: Object.freeze(["chat", "vision", "long-context"]),
  }),
]);

export const MODEL_ID_LIST = Object.freeze(Object.values(MODEL_IDS));
export const EMBEDDING_MODEL_ID_LIST = Object.freeze(
  Object.values(EMBEDDING_MODEL_IDS),
);
