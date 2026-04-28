import type { Context } from 'hono';
import type { HonoEnv } from '../types';
import { getCorsHeadersForRequest } from './cors';
import { getAiDefaultModel, getAiVisionModel } from './config';
import { attachOriginSignatureHeaders, stripOriginSignatureHeaders } from './origin-signature';

export type BackendProxyOptions = {
  upstreamPath: string;
  method?: string;
  stream?: boolean;
  preserveQuery?: boolean;
  injectFallbackAuthorization?: boolean;
  sanitizeClientModel?: boolean;
  forceAiModels?: boolean;
  forceVisionModel?: boolean;
  backendUnavailableMessage?: string;
  overrideBody?: BodyInit | null;
  contentType?: string;
};

function applyCorsHeaders(headers: Headers, corsHeaders: Record<string, string>): void {
  headers.delete('Access-Control-Allow-Origin');
  headers.delete('Access-Control-Allow-Credentials');
  headers.delete('Access-Control-Allow-Methods');
  headers.delete('Access-Control-Allow-Headers');
  headers.delete('Access-Control-Max-Age');

  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
}

function buildBackendUrl(c: Context<HonoEnv>, options: BackendProxyOptions): URL | null {
  const backendOrigin = c.env.BACKEND_ORIGIN;
  if (!backendOrigin) {
    return null;
  }

  const url = new URL(options.upstreamPath, backendOrigin);
  if (options.preserveQuery !== false && !url.search) {
    url.search = new URL(c.req.url).search;
  }
  return url;
}

async function buildProxyHeaders(
  c: Context<HonoEnv>,
  options: BackendProxyOptions,
  backendUrl: URL
): Promise<Headers> {
  const headers = new Headers(c.req.raw.headers);
  const clientIp = c.req.raw.headers.get('CF-Connecting-IP') || '';

  headers.delete('Host');
  headers.delete('X-Backend-Key');
  headers.delete('X-Internal-Gateway-Key');
  headers.delete('X-AI-Model');
  headers.delete('X-AI-Vision-Model');
  stripOriginSignatureHeaders(headers);
  if (c.env.BACKEND_KEY) {
    headers.set('X-Backend-Key', c.env.BACKEND_KEY);
  }

  if (clientIp) {
    headers.set('X-Forwarded-For', clientIp);
    headers.set('X-Real-IP', clientIp);
  }
  headers.set('X-Forwarded-Proto', 'https');

  if (options.stream && !headers.has('Accept')) {
    headers.set('Accept', 'text/event-stream');
  }

  if (options.forceAiModels) {
    const [forcedModel, forcedVisionModel] = await Promise.all([
      getAiDefaultModel(c.env),
      options.forceVisionModel ? getAiVisionModel(c.env) : Promise.resolve(null),
    ]);

    if (forcedModel) {
      headers.set('X-AI-Model', forcedModel);
      headers.set('X-AI-Model-Source', 'gateway');
    }
    if (forcedVisionModel) {
      headers.set('X-AI-Vision-Model', forcedVisionModel);
      headers.set('X-AI-Vision-Model-Source', 'gateway');
    }
  }

  if (
    options.injectFallbackAuthorization !== false &&
    !headers.has('Authorization') &&
    c.env.OPENCODE_AUTH_TOKEN
  ) {
    headers.set('Authorization', `Bearer ${c.env.OPENCODE_AUTH_TOKEN}`);
  }

  if (options.contentType) {
    headers.set('Content-Type', options.contentType);
  }

  await attachOriginSignatureHeaders({
    env: c.env,
    headers,
    method: options.method || c.req.method,
    pathAndQuery: `${backendUrl.pathname}${backendUrl.search}`,
    requestId: c.req.raw.headers.get('X-Request-ID') || undefined,
  });

  return headers;
}

async function buildProxyBody(
  c: Context<HonoEnv>,
  options: BackendProxyOptions,
): Promise<BodyInit | null | undefined> {
  const method = (options.method || c.req.method).toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return undefined;
  }

  if (options.overrideBody !== undefined) {
    return options.overrideBody;
  }

  if (!options.sanitizeClientModel) {
    return c.req.raw.body;
  }

  const contentType = (c.req.header('content-type') || '').toLowerCase();
  const rawBody = await c.req.raw.text();
  if (!contentType.includes('application/json') || !rawBody.trim()) {
    return rawBody;
  }

  try {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return rawBody;
    }
    const sanitized = { ...payload };
    delete sanitized.model;
    return JSON.stringify(sanitized);
  } catch {
    return rawBody;
  }
}

export async function proxyToBackendWithPolicy(
  c: Context<HonoEnv>,
  options: BackendProxyOptions,
): Promise<Response> {
  const corsHeaders = await getCorsHeadersForRequest(c.req.raw, c.env);
  const backendUrl = buildBackendUrl(c, options);
  const method = options.method || c.req.method;
  const unavailableMessage = options.backendUnavailableMessage || 'Could not connect to backend service';

  if (!backendUrl) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'BACKEND_ORIGIN not configured',
        },
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      },
    );
  }

  const [headers, body] = await Promise.all([
    buildProxyHeaders(c, options, backendUrl),
    buildProxyBody(c, options),
  ]);

  try {
    const requestInit: RequestInit & { duplex?: 'half' } = {
      method,
      headers,
      body,
      redirect: 'manual',
      signal: c.req.raw.signal,
    };

    if (
      body !== undefined &&
      body !== null &&
      method.toUpperCase() !== 'GET' &&
      method.toUpperCase() !== 'HEAD'
    ) {
      requestInit.duplex = 'half';
    }

    const response = await fetch(backendUrl.toString(), requestInit);

    const responseHeaders = new Headers(response.headers);
    applyCorsHeaders(responseHeaders, corsHeaders);

    if (options.stream) {
      responseHeaders.set('Cache-Control', 'no-cache, no-transform');
      responseHeaders.set('Connection', 'keep-alive');
      responseHeaders.set('X-Accel-Buffering', 'no');
    }

    if (response.status >= 502 && response.status <= 504) {
      responseHeaders.delete('Content-Length');
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: 'BACKEND_UNAVAILABLE',
            message: unavailableMessage,
          },
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '30',
            ...corsHeaders,
          },
        },
      );
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[backend-proxy] upstream request failed', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: 'BACKEND_UNAVAILABLE',
          message: unavailableMessage,
        },
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '30',
          ...corsHeaders,
        },
      },
    );
  }
}
