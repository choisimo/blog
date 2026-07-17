import { config } from '../../config.js';
import {
  BadGatewayError,
  GatewayTimeoutError,
  ServiceUnavailableError,
} from '../../middleware/errorHandler.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('litellm-image-generation');
const DATA_URL_PATTERN = /^data:([^;,]+)?;base64,(.+)$/i;

function ensureConfigured() {
  const imageConfig = config.ai?.image || {};
  if (!imageConfig.proxyBaseUrl || !imageConfig.proxyApiKey || !imageConfig.model) {
    throw new ServiceUnavailableError('AI image generation is not configured', {
      baseUrlConfigured: Boolean(imageConfig.proxyBaseUrl),
      apiKeyConfigured: Boolean(imageConfig.proxyApiKey),
      modelConfigured: Boolean(imageConfig.model),
    });
  }
  return imageConfig;
}

function joinEndpoint(baseUrl, endpointPath) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const endpoint = String(endpointPath || '').replace(/^\/+/, '');
  if (base.endsWith('/images/generations')) return base;
  return `${base}/${endpoint}`;
}

function decodeImagePayload(item, index) {
  const raw = item?.b64_json || item?.b64Json || item?.dataUrl || item?.url;
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new BadGatewayError('AI image response did not include image data', { index });
  }

  const value = raw.trim();
  let contentType = item?.mimeType || item?.mime_type || null;
  let encoded = value;
  const dataUrlMatch = DATA_URL_PATTERN.exec(value);
  if (dataUrlMatch) {
    contentType = dataUrlMatch[1] || contentType;
    encoded = dataUrlMatch[2];
  } else if (/^https?:\/\//i.test(value)) {
    throw new BadGatewayError('AI image response returned a remote URL instead of image bytes', {
      index,
    });
  }

  let buffer;
  try {
    buffer = Buffer.from(encoded, 'base64');
  } catch {
    throw new BadGatewayError('AI image response contained invalid base64 data', { index });
  }

  if (!buffer.length) {
    throw new BadGatewayError('AI image response decoded to an empty buffer', { index });
  }

  return {
    buffer,
    contentType: contentType || 'image/png',
  };
}

function buildGenerationPayload(input, imageConfig) {
  return {
    model: imageConfig.model,
    prompt: input.prompt,
    n: input.n,
    size: input.size,
    quality: input.quality,
    response_format: 'b64_json',
    output_format: input.outputFormat || 'png',
  };
}

function safeText(value, redactions = []) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  let result = String(value).replace(/\s+/g, ' ').trim();
  for (const candidate of redactions) {
    const normalized = String(candidate || '').replace(/\s+/g, ' ').trim();
    if (normalized.length >= 4) {
      result = result.split(normalized).join('[redacted]');
    }
  }

  result = result
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted]');
  return result ? result.slice(0, 500) : null;
}

function safeIdentifier(value) {
  const result = safeText(value);
  return result && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(result) ? result : null;
}

function extractUpstreamError(response, payload, redactions) {
  const upstreamError = payload && typeof payload === 'object' ? payload.error : null;
  const upstreamCode =
    upstreamError && typeof upstreamError === 'object'
      ? upstreamError.code || upstreamError.type
      : payload?.code;
  const upstreamMessage =
    typeof upstreamError === 'string'
      ? upstreamError
      : upstreamError?.message || payload?.message;
  const upstreamRequestId =
    payload?.request_id ||
    payload?.requestId ||
    upstreamError?.request_id ||
    upstreamError?.requestId ||
    response.headers.get('x-request-id') ||
    response.headers.get('request-id');

  return {
    status: response.status,
    upstreamCode: safeIdentifier(upstreamCode),
    upstreamMessage:
      safeText(upstreamMessage, redactions) ||
      `AI image proxy returned HTTP ${response.status}`,
    upstreamRequestId: safeIdentifier(upstreamRequestId),
  };
}

function classifyRequestFailure(error) {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return 'timeout';

  const code = String(error?.cause?.code || error?.code || '').toUpperCase();
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'dns';
  if (code === 'ECONNREFUSED') return 'connection_refused';
  if (code === 'ECONNRESET') return 'connection_reset';
  if (code === 'ETIMEDOUT') return 'network_timeout';
  if (code.startsWith('ERR_TLS_') || code.startsWith('CERT_')) return 'tls';
  return 'network';
}

export class LiteLLMImageGenerationService {
  getConfigurationState() {
    const imageConfig = config.ai?.image || {};
    return {
      enabled: config.features?.adminAiImageEnabled === true,
      configured: Boolean(
        imageConfig.proxyBaseUrl && imageConfig.proxyApiKey && imageConfig.model,
      ),
      baseUrlConfigured: Boolean(imageConfig.proxyBaseUrl),
      apiKeyConfigured: Boolean(imageConfig.proxyApiKey),
      model: imageConfig.model || null,
      maxCount: imageConfig.maxCount || 1,
      timeoutMs: imageConfig.timeoutMs || 300_000,
    };
  }

  async health() {
    const state = this.getConfigurationState();
    if (!state.enabled || !state.configured) {
      return {
        ...state,
        upstream: {
          ok: false,
          status: state.enabled ? 'not_configured' : 'disabled',
        },
      };
    }

    const imageConfig = config.ai?.image || {};
    const url = joinEndpoint(imageConfig.proxyBaseUrl, '/model-names');
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${imageConfig.proxyApiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(Math.min(5_000, imageConfig.timeoutMs || 5_000)),
      });
      const body = await response.json().catch(() => null);
      const models = Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.models)
          ? body.models
          : Array.isArray(body)
            ? body
            : null;
      const modelAvailable = models
        ? models.some((entry) => {
            const id =
              typeof entry === 'string' ? entry : entry?.id || entry?.name || entry?.model;
            return id === imageConfig.model;
          })
        : null;

      return {
        ...state,
        upstream: {
          ok: response.ok,
          status: response.ok ? 'ok' : `http_${response.status}`,
          modelAvailable,
        },
      };
    } catch (error) {
      return {
        ...state,
        upstream: {
          ok: false,
          status: error?.name === 'TimeoutError' ? 'timeout' : 'unreachable',
        },
      };
    }
  }

  async generateImages(input, options = {}) {
    const imageConfig = ensureConfigured();
    const requestId = options.requestId || `img-${Date.now()}`;
    const startedAt = Date.now();
    const url = joinEndpoint(imageConfig.proxyBaseUrl, '/images/generations');
    const payload = buildGenerationPayload(input, imageConfig);

    logger.info({ requestId }, 'Starting AI image generation', {
      model: imageConfig.model,
      count: payload.n,
      size: payload.size,
      quality: payload.quality,
    });

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${imageConfig.proxyApiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Request-ID': requestId,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(imageConfig.timeoutMs),
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const cause = classifyRequestFailure(error);
      logger.error({ requestId }, 'AI image generation request failed', {
        durationMs,
        model: imageConfig.model,
        cause,
      });
      if (cause === 'timeout') {
        throw new GatewayTimeoutError('AI image proxy request timed out', {
          requestId,
          cause,
          timeoutMs: imageConfig.timeoutMs,
        });
      }
      throw new BadGatewayError('AI image proxy request failed', {
        requestId,
        cause,
      });
    }

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const durationMs = Date.now() - startedAt;
      const details = extractUpstreamError(response, body, [
        imageConfig.proxyApiKey,
        input.prompt,
      ]);
      logger.warn({ requestId }, 'AI image proxy returned a non-2xx response', {
        durationMs,
        model: imageConfig.model,
        status: details.status,
        upstreamCode: details.upstreamCode,
        upstreamRequestId: details.upstreamRequestId,
      });
      throw new BadGatewayError('AI image proxy request failed', {
        requestId,
        ...details,
      });
    }
    if (!Array.isArray(body?.data) || body.data.length === 0) {
      throw new BadGatewayError('AI image proxy returned no images');
    }

    const items = body.data.map((item, index) => decodeImagePayload(item, index));
    const durationMs = Date.now() - startedAt;
    logger.info({ requestId }, 'AI image generation completed', {
      durationMs,
      imageCount: items.length,
      model: body.model || imageConfig.model,
    });

    return {
      model: body.model || imageConfig.model,
      created: body.created || Math.floor(Date.now() / 1000),
      durationMs,
      usage: body.usage || null,
      metadata: body.metadata || null,
      items,
    };
  }
}

export const litellmImageGenerationService = new LiteLLMImageGenerationService();
