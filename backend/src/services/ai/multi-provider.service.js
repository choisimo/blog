import { getProviderSnapshot } from './dynamic-config.service.js';
import { createLogger } from '../../lib/logger.js';
import { getOpenAIClient } from './openai-client.service.js';

const logger = createLogger('multi-provider-ai');

const CACHE_TTL_MS = 60 * 1000;
const DEFAULT_TIMEOUT_MS = 120 * 1000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 30 * 1000;

let configCache = {
  expiresAt: 0,
  value: null,
};

let multiProviderClient = null;

const providerFailures = new Map();

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getProviderFailureState(providerId) {
  if (!providerFailures.has(providerId)) {
    providerFailures.set(providerId, {
      failures: 0,
      lastFailureAt: 0,
    });
  }

  return providerFailures.get(providerId);
}

function isProviderCircuitOpen(providerId) {
  const state = getProviderFailureState(providerId);

  if (state.failures < CIRCUIT_BREAKER_THRESHOLD) {
    return false;
  }

  if (Date.now() - state.lastFailureAt >= CIRCUIT_BREAKER_RESET_MS) {
    state.failures = 0;
    state.lastFailureAt = 0;
    return false;
  }

  return true;
}

function recordProviderFailure(providerId) {
  const state = getProviderFailureState(providerId);
  state.failures += 1;
  state.lastFailureAt = Date.now();

  if (state.failures === CIRCUIT_BREAKER_THRESHOLD) {
    logger.warn(
      { operation: 'circuit_breaker', providerId },
      'Provider circuit breaker opened',
      { resetAfterMs: CIRCUIT_BREAKER_RESET_MS },
    );
  }
}

function recordProviderSuccess(providerId) {
  const state = getProviderFailureState(providerId);
  state.failures = 0;
  state.lastFailureAt = 0;
}

function normalizeUsage(usage) {
  return {
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    total_tokens:
      usage?.total_tokens ??
      (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0),
  };
}

function extractTextContent(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.type === 'text') return item.text || '';
        return '';
      })
      .join('')
      .trim();
  }

  return '';
}

function buildChatEndpoint(apiBaseUrl) {
  const normalizedBaseUrl = (apiBaseUrl || 'https://api.openai.com')
    .replace(/\/+$/, '');

  if (normalizedBaseUrl.endsWith('/v1')) {
    return `${normalizedBaseUrl}/chat/completions`;
  }

  return `${normalizedBaseUrl}/v1/chat/completions`;
}

function buildMessages(prompt, systemPrompt) {
  const messages = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  return messages;
}

function createModelLookup(models) {
  const map = new Map();

  for (const model of models) {
    map.set(model.id, model);
  }

  return map;
}

function sortByPriorityDesc(a, b) {
  return (b.priority || 0) - (a.priority || 0);
}

function buildFallbackChain(config, requestedModel) {
  const ordered = [];
  const seenModelIds = new Set();
  const modelsById = config.modelsById;

  const addModel = (modelId) => {
    if (!modelId || seenModelIds.has(modelId)) {
      return;
    }

    const model = modelsById.get(modelId);
    if (!model) {
      return;
    }

    // Skip embedding-only models (max_tokens=0) — they cannot produce
    // chat completions and would always fail in the fallback chain.
    if (model.max_tokens === 0) {
      return;
    }

    const provider = config.providersById.get(model.provider_id);
    if (!provider) {
      return;
    }

    seenModelIds.add(modelId);
    ordered.push({ provider, model });
  };

  if (requestedModel) {
    const requestedMatches = config.models
      .filter(
        (model) =>
          model.id === requestedModel ||
          model.model_name === requestedModel ||
          model.model_identifier === requestedModel,
      )
      .sort(sortByPriorityDesc);

    for (const model of requestedMatches) {
      addModel(model.id);
    }
  }

  addModel(config.defaultRoute?.primary_model_id);

  for (const modelId of config.defaultRoute?.fallbackModelIds || []) {
    addModel(modelId);
  }

  const remainingModels = config.models
    .filter((model) => !seenModelIds.has(model.id))
    .sort(sortByPriorityDesc);

  for (const model of remainingModels) {
    addModel(model.id);
  }

  return ordered;
}

async function loadConfig(force = false) {
  if (!force && configCache.value && Date.now() < configCache.expiresAt) {
    return configCache.value;
  }

  // Fetch from Worker snapshot (centralized config)
  const snapshot = await getProviderSnapshot();
  if (!snapshot || !snapshot.providers.length) {
    return null;
  }

  // Map Worker snapshot shape to the internal config structure.
  // Provider fields from Worker use camelCase; the rest of multi-provider
  // logic expects snake_case (matching the D1 column names), so we map here.
  const providers = snapshot.providers.map((p) => ({
    id: p.id,
    name: p.name,
    display_name: p.displayName,
    api_base_url: p.apiBaseUrl,
    api_key_env: p.apiKeyEnv,
    is_enabled: p.isEnabled ? 1 : 0,
    health_status: p.healthStatus,
    // Attach the resolved key so createChatCompletion can use it directly
    resolvedApiKey: p.resolvedApiKey,
  }));

  const models = (snapshot.models || []).sort(sortByPriorityDesc);

  const rawRoute = snapshot.defaultRoute;
  const defaultRoute = rawRoute
    ? {
        ...rawRoute,
        fallbackModelIds: parseJsonArray(rawRoute.fallback_model_ids),
      }
    : null;

  const value = {
    providers,
    providersById: new Map(providers.map((provider) => [provider.id, provider])),
    models,
    modelsById: createModelLookup(models),
    defaultRoute,
    loadedAt: Date.now(),
  };

  configCache = {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return value;
}

async function createChatCompletion(provider, model, messages, options = {}) {
  const url = buildChatEndpoint(provider.api_base_url);
  const headers = {
    'Content-Type': 'application/json',
  };

  const apiKey = provider.resolvedApiKey ?? undefined;

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const timeoutMs =
    options.timeout || options.timeoutMs || DEFAULT_TIMEOUT_MS;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model.model_identifier,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || options.max_tokens,
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const rawText = await response.text();
  let payload = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      payload?.error?.message ||
      payload?.message ||
      rawText ||
      `Request failed with status ${response.status}`;

    const error = new Error(errorMessage);
    error.status = response.status;
    error.providerId = provider.id;
    error.modelId = model.id;
    throw error;
  }

  return payload || {};
}

export class MultiProviderAIService {
  constructor() {
    this.fallbackClient = null;

    // Prime the config cache from Worker snapshot on init
    loadConfig().catch((error) => {
      logger.warn(
        { operation: 'init' },
        'Failed to prime multi-provider config cache',
        { error: error.message },
      );
    });
  }

  getFallbackClient() {
    if (!this.fallbackClient) {
      this.fallbackClient = getOpenAIClient();
    }

    return this.fallbackClient;
  }

  async chat(messages, options = {}) {
    const config = await loadConfig(options.forceRefresh === true);

    if (!config) {
      return this.getFallbackClient().chat(messages, options);
    }
    const chain = buildFallbackChain(config, options.model);
    const requestId = `multi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const routeTimeoutMs = config?.defaultRoute?.timeout_seconds
      ? Number(config.defaultRoute.timeout_seconds) * 1000
      : undefined;

    if (!chain.length) {
      throw new Error('No enabled AI providers or models configured');
    }

    const errors = [];

    for (const candidate of chain) {
      const { provider, model } = candidate;

      if (isProviderCircuitOpen(provider.id)) {
        logger.warn(
          { operation: 'chat', requestId, providerId: provider.id, modelId: model.id },
          'Skipping provider because circuit breaker is open',
        );
        continue;
      }

      logger.info(
        { operation: 'chat', requestId, providerId: provider.id, modelId: model.id },
        'Attempting provider chat completion',
        {
          providerName: provider.name,
          modelName: model.model_name,
        },
      );

      try {
        const response = await createChatCompletion(provider, model, messages, {
          ...options,
          timeout: options.timeout || routeTimeoutMs,
        });

        recordProviderSuccess(provider.id);

        const result = {
          content: extractTextContent(response?.choices?.[0]?.message?.content),
          model: response.model || model.model_name,
          provider: provider.id,
          usage: normalizeUsage(response.usage),
          finishReason: response?.choices?.[0]?.finish_reason || 'stop',
        };

        logger.info(
          { operation: 'chat', requestId, providerId: provider.id, modelId: model.id },
          'Provider chat completion succeeded',
          {
            providerName: provider.name,
            modelName: result.model,
          },
        );

        return result;
      } catch (error) {
        recordProviderFailure(provider.id);
        errors.push({
          providerId: provider.id,
          providerName: provider.name,
          modelId: model.id,
          modelName: model.model_name,
          message: error.message,
        });

        logger.error(
          { operation: 'chat', requestId, providerId: provider.id, modelId: model.id },
          'Provider chat completion failed',
          {
            providerName: provider.name,
            modelName: model.model_name,
            error: error.message,
          },
        );
      }
    }

    const lastError = errors[errors.length - 1];
    const error = new Error(
      lastError
        ? `All AI providers failed. Last error: ${lastError.message}`
        : 'All AI providers failed',
    );
    error.attempts = errors;
    throw error;
  }

  async generate(prompt, options = {}) {
    const config = await loadConfig();

    if (!config) {
      return this.getFallbackClient().generate(prompt, options);
    }

    const result = await this.chat(buildMessages(prompt, options.systemPrompt), {
      ...options,
    });

    return result.content;
  }

  async health(force = false) {
    const config = await loadConfig(force);

    if (!config) {
      return this.getFallbackClient().health(force);
    }

    return {
      ok: config.providers.length > 0,
      provider: 'multi-provider',
      providers: config.providers.map((provider) => ({
        id: provider.id,
        name: provider.display_name || provider.name,
        isEnabled: !!provider.is_enabled,
        healthStatus: provider.health_status,
      })),
      checkedAt: new Date().toISOString(),
      force,
    };
  }

  getProviderInfo() {
    const cachedProviders = configCache.value?.providers || [];

    if (!cachedProviders.length) {
      return this.getFallbackClient().getProviderInfo();
    }

    return {
      provider: 'multi-provider',
      providers: cachedProviders.map((provider) => ({
        id: provider.id,
        name: provider.display_name || provider.name,
        isEnabled: !!provider.is_enabled,
        healthStatus: provider.health_status,
      })),
    };
  }
}

export function getMultiProviderClient() {
  if (!multiProviderClient) {
    multiProviderClient = new MultiProviderAIService();
  }

  return multiProviderClient;
}

export function isD1ConfiguredForMultiProvider() {
  // Preserved for API compatibility. Now checks Worker config availability
  // instead of local D1, since config is consumed from the Worker.
  return !!configCache.value;
}
