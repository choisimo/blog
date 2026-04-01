import { config } from '../config.js';

const MODEL_CAPABILITIES = {
  'gpt-4o': { 
    vision: true, 
    streaming: true, 
    functionCalling: true,
    contextWindow: 128000,
  },
  'gpt-4o-mini': { 
    vision: true, 
    streaming: true, 
    functionCalling: true,
    contextWindow: 128000,
  },
  'gpt-4-turbo': { 
    vision: true, 
    streaming: true, 
    functionCalling: true,
    contextWindow: 128000,
  },
  'gpt-4': { 
    vision: false, 
    streaming: true, 
    functionCalling: true,
    contextWindow: 8192,
  },
  'gpt-3.5-turbo': { 
    vision: false, 
    streaming: true, 
    functionCalling: true,
    contextWindow: 16385,
  },
  'claude-3-5-sonnet-20241022': {
    vision: true,
    streaming: true,
    functionCalling: true,
    contextWindow: 200000,
  },
  'claude-3-opus-20240229': {
    vision: true,
    streaming: true,
    functionCalling: true,
    contextWindow: 200000,
  },
  'claude-3-sonnet-20240229': {
    vision: true,
    streaming: true,
    functionCalling: true,
    contextWindow: 200000,
  },
  'claude-3-haiku-20240307': {
    vision: true,
    streaming: true,
    functionCalling: true,
    contextWindow: 200000,
  },
};

const DEFAULT_CAPABILITIES = {
  vision: false,
  streaming: true,
  functionCalling: false,
  contextWindow: 4096,
};

const MODEL_FALLBACKS = {
  'gpt-4o': ['gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  'gpt-4o-mini': ['gpt-3.5-turbo'],
  'gpt-4-turbo': ['gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'],
  'gpt-4': ['gpt-4o-mini', 'gpt-3.5-turbo'],
  'claude-3-5-sonnet-20241022': ['claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  'claude-3-opus-20240229': ['claude-3-5-sonnet-20241022', 'claude-3-sonnet-20240229'],
};

const EMBEDDING_MODELS = {
  'text-embedding-3-small': { dimensions: 1536 },
  'text-embedding-3-large': { dimensions: 3072 },
  'text-embedding-ada-002': { dimensions: 1536 },
};

export function getModelCapabilities(model) {
  const normalized = normalizeModelName(model);
  return MODEL_CAPABILITIES[normalized] || DEFAULT_CAPABILITIES;
}

export function supportsVision(model) {
  return getModelCapabilities(model).vision;
}

export function supportsStreaming(model) {
  return getModelCapabilities(model).streaming;
}

export function supportsFunctionCalling(model) {
  return getModelCapabilities(model).functionCalling;
}

export function getContextWindow(model) {
  return getModelCapabilities(model).contextWindow;
}

export function getModelFallbacks(model) {
  const normalized = normalizeModelName(model);
  return MODEL_FALLBACKS[normalized] || [];
}

export function selectBestModel(requirements = {}) {
  const { vision = false, functionCalling = false, minContext = 4096 } = requirements;
  
  const candidates = Object.entries(MODEL_CAPABILITIES)
    .filter(([_, caps]) => {
      if (vision && !caps.vision) return false;
      if (functionCalling && !caps.functionCalling) return false;
      if (caps.contextWindow < minContext) return false;
      return true;
    })
    .sort((a, b) => b[1].contextWindow - a[1].contextWindow);
  
  if (candidates.length === 0) {
    return config.ai?.defaultModel || 'gpt-4o-mini';
  }
  
  return candidates[0][0];
}

function normalizeModelName(model) {
  if (!model) return '';
  const lower = model.toLowerCase();
  
  for (const known of Object.keys(MODEL_CAPABILITIES)) {
    if (lower.includes(known.toLowerCase())) {
      return known;
    }
  }
  
  return model;
}

export function getEmbeddingDimensions(model) {
  const normalized = model?.toLowerCase() || 'text-embedding-3-small';
  return EMBEDDING_MODELS[normalized]?.dimensions || 1536;
}

export function isValidModel(model) {
  const normalized = normalizeModelName(model);
  return normalized in MODEL_CAPABILITIES;
}

export function listAvailableModels() {
  return Object.keys(MODEL_CAPABILITIES);
}

export function getDefaultModel() {
  return config.ai?.defaultModel || 'gpt-4o-mini';
}

export function getVisionModel() {
  return config.ai?.visionModel || 'gpt-4o';
}

export function getEmbeddingModel() {
  return config.rag?.embeddingModel || 'text-embedding-3-small';
}
