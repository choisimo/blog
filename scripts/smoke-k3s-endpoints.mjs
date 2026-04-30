#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = (process.env.SMOKE_BASE_URL || 'http://localhost:8093').replace(/\/$/, '');
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 12000);

const registry = [
  { boundaryId: 'auth', basePath: '/api/v1/auth', file: 'backend/src/routes/auth.js' },
  { boundaryId: 'notifications', basePath: '/api/v1/notifications', file: 'backend/src/routes/notifications.js' },
  { boundaryId: 'ai', basePath: '/api/v1/ai', file: 'backend/src/routes/ai.js' },
  { boundaryId: 'analytics', basePath: '/api/v1/analytics', file: 'backend/src/routes/analytics.js' },
  { boundaryId: 'chat', basePath: '/api/v1/chat', file: 'backend/src/routes/chat.js' },
  { boundaryId: 'translate', basePath: '/api/v1', file: 'backend/src/routes/translate.js' },
  { boundaryId: 'memos', basePath: '/api/v1/memos', file: 'backend/src/routes/memos.js' },
  { boundaryId: 'user-content', basePath: '/api/v1/user-content', file: 'backend/src/routes/userContent.js' },
  { boundaryId: 'og', basePath: '/api/v1/og', file: 'backend/src/routes/og.js' },
  { boundaryId: 'admin', basePath: '/api/v1/admin', file: 'backend/src/routes/admin.js' },
  { boundaryId: 'posts', basePath: '/api/v1/posts', file: 'backend/src/routes/posts.js' },
  { boundaryId: 'images', basePath: '/api/v1/images', file: 'backend/src/routes/images.js' },
  { boundaryId: 'rag', basePath: '/api/v1/rag', file: 'backend/src/routes/rag.js' },
  { boundaryId: 'memories', basePath: '/api/v1/memories', file: 'backend/src/routes/memories.js' },
  { boundaryId: 'user', basePath: '/api/v1/user', file: 'backend/src/routes/user.js' },
  { boundaryId: 'search', basePath: '/api/v1/search', file: 'backend/src/routes/search.js' },
  { boundaryId: 'admin-config', basePath: '/api/v1/admin/config', file: 'backend/src/routes/config.js' },
  { boundaryId: 'admin-workers', basePath: '/api/v1/admin/workers', file: 'backend/src/routes/workers.js' },
  { boundaryId: 'admin-logs', basePath: '/api/v1/admin/logs', file: 'backend/src/routes/adminLogs.js' },
  { boundaryId: 'admin-analytics', basePath: '/api/v1/admin/analytics', file: 'backend/src/routes/adminAnalytics.js' },
  { boundaryId: 'agent', basePath: '/api/v1/agent', file: 'backend/src/routes/agent.js' },
  { boundaryId: 'debate', basePath: '/api/v1/debate', file: 'backend/src/routes/debate.js' },
  { boundaryId: 'execute', basePath: '/api/v1/execute', file: 'backend/src/routes/execute.js' },
];

const manualEndpoints = [
  { boundaryId: 'core', method: 'GET', path: '/api/v1/healthz' },
  { boundaryId: 'core', method: 'GET', path: '/health' },
  { boundaryId: 'core', method: 'GET', path: '/api/v1/readiness' },
  { boundaryId: 'public-config', method: 'GET', path: '/api/v1/public/config' },
  { boundaryId: 'metrics', method: 'GET', path: '/metrics' },
];

const streamPattern = /\/stream(?:$|[/?])|\/generate\/stream(?:$|[/?])/;
const riskyExact = new Set([
  'POST /api/v1/analytics/refresh-stats',
  'DELETE /api/v1/ai/dlq',
  'POST /api/v1/ai/dlq/smoke-message/reprocess',
  'DELETE /api/v1/rag/index/smoke-document',
  'DELETE /api/v1/rag/memories/smoke-user/smoke-memory/internal',
  'DELETE /api/v1/rag/memories/smoke-user/smoke-memory',
]);

function joinPath(basePath, routePath) {
  if (routePath === '/') return basePath;
  return `${basePath.replace(/\/$/, '')}/${routePath.replace(/^\//, '')}`;
}

function samplePath(routePath) {
  const replacements = {
    year: '2025',
    slug: 'latest',
    targetLang: 'ko',
    userId: 'smoke-user',
    memoryId: 'smoke-memory',
    version: '1',
    sessionId: 'smoke-session',
    notificationId: 'smoke-notification',
    workerId: 'api-gateway',
    id: 'smoke-id',
    mode: 'default',
    filename: 'smoke.png',
    documentId: 'smoke-document',
    messageId: 'smoke-message',
  };

  return routePath.replace(/:([A-Za-z0-9_]+)/g, (_, name) => replacements[name] || `smoke-${name}`);
}

function requestBody(endpoint) {
  if (endpoint.method === 'GET' || endpoint.method === 'DELETE') return undefined;

  if (endpoint.path === '/api/v1/ai/generate') {
    return { prompt: 'Reply with exactly: pong' };
  }
  if (endpoint.path === '/api/v1/ai/auto-chat') {
    return { messages: [{ role: 'user', content: 'Reply with exactly: pong' }], maxTokens: 8 };
  }
  if (endpoint.path === '/api/v1/search/web') {
    return { query: 'test', maxResults: 1, searchDepth: 'basic' };
  }
  if (endpoint.path === '/api/v1/analytics/view') {
    return { year: '2025', slug: 'latest', eventId: 'smoke-endpoint-check' };
  }
  if (endpoint.path === '/api/v1/chat/session/smoke-session/message') {
    return { parts: [] };
  }
  if (endpoint.path === '/api/v1/chat/aggregate') {
    return {};
  }
  if (endpoint.path === '/api/v1/debate/sessions') {
    return {};
  }
  if (endpoint.path === '/api/v1/execute') {
    return {
      language: 'javascript',
      version: '*',
      files: [{ content: 'console.log("pong")' }],
      run_timeout: 3000,
    };
  }
  return {};
}

function parseRoutes(source) {
  const routes = [];
  const regex = /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    routes.push({ method: match[1].toUpperCase(), routePath: match[2] });
  }
  return routes;
}

async function buildEndpointList() {
  const endpoints = [...manualEndpoints];
  for (const entry of registry) {
    const abs = path.join(repoRoot, entry.file);
    const source = await fs.readFile(abs, 'utf8');
    for (const route of parseRoutes(source)) {
      endpoints.push({
        boundaryId: entry.boundaryId,
        method: route.method,
        path: joinPath(entry.basePath, samplePath(route.routePath)),
        source: `${entry.file}:${route.routePath}`,
      });
    }
  }

  const seen = new Set();
  return endpoints.filter((endpoint) => {
    const key = `${endpoint.method} ${endpoint.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shouldSkip(endpoint) {
  const key = `${endpoint.method} ${endpoint.path}`;
  if (riskyExact.has(key)) return 'risk: destructive or expensive mutation';
  if (streamPattern.test(endpoint.path)) return 'risk: long-lived SSE/stream endpoint';
  return null;
}

function classify(endpoint, status, bodyText) {
  if (status >= 500) return 'fail';
  if (status >= 400) return 'ok';

  let json = null;
  try {
    json = JSON.parse(bodyText);
  } catch {
    json = null;
  }

  const isHealthPath = /\/(health|readiness|status)(?:$|[/?])/.test(endpoint.path);
  if (isHealthPath && json?.ok === false) return 'degraded';

  return 'ok';
}

function expectedUnavailableReason(endpoint, status, bodyText) {
  if (status !== 503) return null;

  let json = null;
  try {
    json = JSON.parse(bodyText);
  } catch {
    json = null;
  }

  const errorText =
    typeof json?.error === 'string'
      ? json.error
      : typeof json?.error?.message === 'string'
        ? json.error.message
        : '';
  const errorCode = typeof json?.error?.code === 'string' ? json.error.code : '';

  if (errorCode === 'TOTP_BOOTSTRAP_DISABLED') {
    return 'expected: TOTP_SECRET is not provisioned in this protected k3s environment';
  }
  if (/OAuth not configured/.test(errorText)) {
    return 'expected: OAuth client credentials are not configured';
  }
  if (errorCode === 'FEATURE_DISABLED') {
    return 'expected: feature flag disables this endpoint in the current k3s runtime';
  }

  return null;
}

async function callEndpoint(endpoint, index) {
  const skipReason = shouldSkip(endpoint);
  if (skipReason) {
    return { ...endpoint, result: 'skipped', reason: skipReason };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const body = requestBody(endpoint);

  try {
    const response = await fetch(`${baseUrl}${endpoint.path}`, {
      method: endpoint.method,
      redirect: 'manual',
      headers: {
        Accept: 'application/json, text/plain, image/svg+xml, */*',
        'X-Forwarded-For': `10.254.${Math.floor(index / 240)}.${(index % 240) + 1}`,
        'X-Real-IP': `10.254.${Math.floor(index / 240)}.${(index % 240) + 1}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    const expectedUnavailable = expectedUnavailableReason(endpoint, response.status, text);
    return {
      ...endpoint,
      result: expectedUnavailable ? 'skipped' : classify(endpoint, response.status, text),
      ...(expectedUnavailable ? { reason: expectedUnavailable } : {}),
      status: response.status,
      contentType: response.headers.get('content-type') || null,
      sample: text.slice(0, 500),
    };
  } catch (error) {
    return {
      ...endpoint,
      result: 'fail',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const endpoints = await buildEndpointList();
  const results = [];
  for (let index = 0; index < endpoints.length; index += 1) {
    results.push(await callEndpoint(endpoints[index], index));
  }

  const summary = {
    baseUrl,
    checkedAt: new Date().toISOString(),
    total: results.length,
    ok: results.filter((r) => r.result === 'ok').length,
    degraded: results.filter((r) => r.result === 'degraded').length,
    skipped: results.filter((r) => r.result === 'skipped').length,
    failed: results.filter((r) => r.result === 'fail').length,
  };

  const report = { summary, results };
  const outDir = path.join(repoRoot, 'audit', 'endpoints');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `k3s-smoke-${summary.checkedAt.replace(/[:.]/g, '-')}.json`);
  await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify(summary, null, 2));
  console.log(`report=${outPath}`);

  const problemRows = results.filter((r) => r.result === 'fail' || r.result === 'degraded');
  for (const row of problemRows) {
    console.log(`${row.result.toUpperCase()} ${row.method} ${row.path} status=${row.status ?? 'n/a'} ${row.error ?? ''}`);
  }

  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
