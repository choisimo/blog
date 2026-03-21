import { config } from "../config.js";
import {
  AI_MODELS,
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_MODEL_CAPABILITIES,
  EMBEDDING_MODEL_CATALOG,
  EMBEDDING_MODEL_ID_LIST,
  MODEL_CAPABILITY_CATALOG,
  MODEL_FALLBACK_CATALOG,
  MODEL_ID_LIST,
} from "../config/constants.js";

export function getModelCapabilities(model) {
  const normalized = normalizeModelName(model);
  return MODEL_CAPABILITY_CATALOG[normalized] || DEFAULT_MODEL_CAPABILITIES;
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
  return MODEL_FALLBACK_CATALOG[normalized] || [];
}

export function selectBestModel(requirements = {}) {
  const {
    vision = false,
    functionCalling = false,
    minContext = 4096,
  } = requirements;

  const candidates = Object.entries(MODEL_CAPABILITY_CATALOG)
    .filter(([_, caps]) => {
      if (vision && !caps.vision) return false;
      if (functionCalling && !caps.functionCalling) return false;
      if (caps.contextWindow < minContext) return false;
      return true;
    })
    .sort((a, b) => b[1].contextWindow - a[1].contextWindow);

  if (candidates.length === 0) {
    return config.ai?.defaultModel || AI_MODELS.DEFAULT;
  }

  return candidates[0][0];
}

function normalizeModelName(model) {
  return normalizeKnownModelName(model, MODEL_ID_LIST);
}

function normalizeEmbeddingModelName(model) {
  return normalizeKnownModelName(model, EMBEDDING_MODEL_ID_LIST);
}

function normalizeKnownModelName(model, knownModels) {
  if (!model) return "";
  const lower = model.toLowerCase();

  for (const known of [...knownModels].sort((a, b) => b.length - a.length)) {
    if (lower.includes(known.toLowerCase())) {
      return known;
    }
  }

  return model;
}

export function getEmbeddingDimensions(model) {
  const normalized = normalizeEmbeddingModelName(model || AI_MODELS.EMBEDDING);
  return (
    EMBEDDING_MODEL_CATALOG[normalized]?.dimensions ||
    DEFAULT_EMBEDDING_DIMENSIONS
  );
}

export function isValidModel(model) {
  const normalized = normalizeModelName(model);
  return normalized in MODEL_CAPABILITY_CATALOG;
}

export function listAvailableModels() {
  return Object.keys(MODEL_CAPABILITY_CATALOG);
}

export function getDefaultModel() {
  return config.ai?.defaultModel || AI_MODELS.DEFAULT;
}

export function getVisionModel() {
  return config.ai?.visionModel || AI_MODELS.VISION;
}

export function getEmbeddingModel() {
  return config.rag?.embeddingModel || AI_MODELS.EMBEDDING;
}
