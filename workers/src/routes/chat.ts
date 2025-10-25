import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../types';

type ChatContext = { Bindings: Env };

const chat = new Hono<ChatContext>();
async function proxyRequest(c: Context<ChatContext>, path: string) {
  const aiServeBaseUrl = c.env.AI_SERVE_BASE_URL || 'https://ai-check.nodove.com';
  const upstreamUrl = `${aiServeBaseUrl}${path}`;

  const upstreamHeaders = new Headers(c.req.raw.headers);
  upstreamHeaders.delete('host');

  if (c.env.AI_GATEWAY_CALLER_KEY) {
    upstreamHeaders.set('X-Gateway-Caller-Key', c.env.AI_GATEWAY_CALLER_KEY);
  }
  if (c.env.OPENCODE_AUTH_TOKEN) {
    upstreamHeaders.set('Authorization', `Bearer ${c.env.OPENCODE_AUTH_TOKEN}`);
  } else if (c.env.GITHUB_TOKEN) {
    upstreamHeaders.set('Authorization', `Bearer ${c.env.GITHUB_TOKEN}`);
  }

  const upstreamRequest = new Request(upstreamUrl, {
    method: c.req.method,
    headers: upstreamHeaders,
    body: c.req.raw.body,
    redirect: 'manual',
  });

  const upstreamResponse = await fetch(upstreamRequest);

  const headers = new Headers(upstreamResponse.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', '*');

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers,
  });
}

// '/session' 경로의 POST 요청은 업스트림 '/session'으로 프록시합니다.
chat.post('/session', async (c) => {
  return proxyRequest(c, '/session');
});

chat.post('/session/:sessionId/message', async (c) => {
  const { sessionId } = c.req.param();
  return proxyRequest(c, `/session/${sessionId}/message`);
});

export default chat;
