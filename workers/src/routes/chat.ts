import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../types';
import { badRequest } from '../lib/response';

type ChatContext = { Bindings: Env };

const chat = new Hono<ChatContext>();

function getChatBase(env: Env): string {
  const base = env.AI_SERVE_BASE_URL || 'https://ai-serve.nodove.com';
  return base.replace(/\/$/, '');
}

function buildHeaders(env: Env): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (env.AI_SERVE_API_KEY) {
    headers['X-Api-Key'] = env.AI_SERVE_API_KEY;
  }
  return headers;
}

chat.post('/session', async (c: Context<ChatContext>) => {
  let requestBody: Record<string, unknown> | undefined;
  try {
    requestBody = await c.req.json<Record<string, unknown>>();
  } catch {
    requestBody = undefined;
  }

  const title = typeof requestBody?.title === 'string' && requestBody.title.trim().length > 0
    ? requestBody.title
    : 'Nodove Blog Visitor Session';

  const upstreamInit: RequestInit = {
    method: 'POST',
    headers: buildHeaders(c.env),
    body: JSON.stringify({
      ...(requestBody || {}),
      title,
    }),
  };

  const upstreamResponse = await fetch(`${getChatBase(c.env)}/session`, upstreamInit);

  if (!upstreamResponse.ok) {
    const errorText = await upstreamResponse.text().catch(() => '');
    return badRequest(
      c,
      `Chat session creation failed (${upstreamResponse.status}): ${errorText.slice(0, 200)}`,
    );
  }

  const result = await upstreamResponse.json<unknown>().catch(() => undefined);
  if (!result) {
    return badRequest(c, 'Invalid response when creating chat session');
  }

  return c.json(result, upstreamResponse.status);
});

chat.post('/session/:sessionId/message', async (c: Context<ChatContext>) => {
  const sessionId = c.req.param('sessionId');
  if (!sessionId) {
    return badRequest(c, 'sessionId is required');
  }

  const rawBody = await c.req.text();
  if (!rawBody) {
    return badRequest(c, 'Request body is required');
  }

  const upstreamRequest = new Request(
    `${getChatBase(c.env)}/session/${encodeURIComponent(sessionId)}/message`,
    {
      method: 'POST',
      headers: buildHeaders(c.env),
      body: rawBody,
    },
  );

  const upstreamResponse = await fetch(upstreamRequest);

  const headers = new Headers(upstreamResponse.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Expose-Headers', '*');

  if (!upstreamResponse.body) {
    const fallbackText = await upstreamResponse.text().catch(() => '');
    return new Response(fallbackText || null, {
      status: upstreamResponse.status,
      headers,
    });
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers,
  });
});

export default chat;
