#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const OPENCODE_BASE = process.env.OPENCODE_BASE || 'http://opencode:7012';
const PORT = process.env.PROXY_PORT || 7016;
const DEFAULT_PROVIDER = process.env.DEFAULT_PROVIDER || 'github-copilot';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gpt-4.1';
const DEFAULT_SESSION_TITLE = process.env.DEFAULT_SESSION_TITLE || 'Auto Session';
const REQUIRE_CLIENT_AUTH = process.env.REQUIRE_CLIENT_AUTH === 'true';
const STATIC_BEARER = process.env.OPENCODE_BEARER_TOKEN || '';
const STATIC_BEARER_FILE = process.env.OPENCODE_BEARER_TOKEN_FILE || '';
const TOKEN_FILE_POLL_INTERVAL = parseInt(process.env.TOKEN_FILE_POLL_INTERVAL || '5000', 10);
const TOKEN_FILE_MAX_WAIT = parseInt(process.env.TOKEN_FILE_MAX_WAIT || '120000', 10);
const MESSAGE_TIMEOUT = parseInt(process.env.MESSAGE_TIMEOUT || '120000', 10);

let cachedStaticBearer = STATIC_BEARER.trim();
let lastFileStat = 0;
let tokenFileReady = !STATIC_BEARER_FILE;

function readStaticBearerFromFile() {
  if (!STATIC_BEARER_FILE) return '';
  try {
    const stat = fs.statSync(STATIC_BEARER_FILE);
    if (stat.mtimeMs === lastFileStat && cachedStaticBearer) {
      return cachedStaticBearer;
    }
    const raw = fs.readFileSync(STATIC_BEARER_FILE, 'utf8').trim();
    lastFileStat = stat.mtimeMs;
    if (raw) {
      cachedStaticBearer = raw;
      tokenFileReady = true;
      return cachedStaticBearer;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[WARN] Failed to read token file ${STATIC_BEARER_FILE}: ${err.message}`);
    }
  }
  return '';
}

async function waitForTokenFile() {
  if (!STATIC_BEARER_FILE) {
    console.log('[STARTUP] No token file configured, proceeding without token');
    return true;
  }
  
  console.log(`[STARTUP] Waiting for token file: ${STATIC_BEARER_FILE}`);
  const startTime = Date.now();
  
  while (Date.now() - startTime < TOKEN_FILE_MAX_WAIT) {
    const token = readStaticBearerFromFile();
    if (token) {
      console.log(`[STARTUP] Token file ready (${token.length} chars)`);
      return true;
    }
    
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[STARTUP] Token file not ready, waiting... (${elapsed}s elapsed)`);
    await new Promise(resolve => setTimeout(resolve, TOKEN_FILE_POLL_INTERVAL));
  }
  
  console.warn(`[STARTUP] WARNING: Token file not found after ${TOKEN_FILE_MAX_WAIT}ms, proceeding without token`);
  tokenFileReady = true;
  return false;
}

function resolveStaticBearerHeader() {
  if (!cachedStaticBearer) {
    cachedStaticBearer = readStaticBearerFromFile();
  }
  if (!cachedStaticBearer) return '';
  return cachedStaticBearer.startsWith('Bearer ')
    ? cachedStaticBearer
    : `Bearer ${cachedStaticBearer}`;
}

const MESSAGE_PATHS = [
  ['message'],
  ['text'],
  ['content'],
  ['prompt'],
  ['input'],
  ['question'],
  ['body', 'message'],
  ['body', 'text'],
  ['body', 'content'],
  ['body', 'prompt'],
  ['data', 'message'],
  ['data', 'text'],
  ['data', 'content'],
  ['inputs', 'message'],
  ['inputs', 'text'],
  ['inputs', 'prompt'],
];

function getValueAtPath(obj, path) {
  return path.reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[key];
  }, obj);
}

function parseMaybeJSON(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      return trimmed;
    }
  }
  return trimmed;
}

function mergeQueryParams(target, queryParams) {
  if (!queryParams) return target;
  const merged = { ...(target || {}) };
  for (const [key, value] of Object.entries(queryParams)) {
    if (merged[key] === undefined) {
      merged[key] = parseMaybeJSON(value);
    }
  }
  return merged;
}

function getStringByPaths(obj, paths) {
  if (!obj || typeof obj !== 'object') return '';
  for (const path of paths) {
    const value = getValueAtPath(obj, path);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return '';
}

function extractMessage(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') return payload.trim();

  const direct = getStringByPaths(payload, MESSAGE_PATHS);
  if (direct) return direct;

  const nestedContainers = [payload.body, payload.data, payload.inputs, payload.input];
  for (const container of nestedContainers) {
    if (container && typeof container === 'object') {
      const nested = extractMessage(container);
      if (nested) return nested;
    }
  }

  if (Array.isArray(payload.messages)) {
    for (let i = payload.messages.length - 1; i >= 0; i -= 1) {
      const msg = payload.messages[i];
      const fromMessage = extractMessage(msg);
      if (fromMessage) return fromMessage;
      if (Array.isArray(msg?.parts)) {
        for (const part of msg.parts) {
          if (typeof part === 'string' && part.trim()) return part.trim();
          const partText = getStringByPaths(part, [['text'], ['content'], ['value']]);
          if (partText) return partText;
        }
      }
    }
  }
  return '';
}

function normalizePartsArray(arr) {
  if (!Array.isArray(arr)) return [];
  const parts = [];
  for (const entry of arr) {
    if (!entry) continue;
    if (typeof entry === 'string') {
      const text = entry.trim();
      if (text) parts.push({ type: 'text', text });
      continue;
    }
    if (typeof entry === 'object') {
      const text = getStringByPaths(entry, [['text'], ['content'], ['value']]);
      if (text) {
        const type = typeof entry.type === 'string' && entry.type.trim() ? entry.type.trim() : 'text';
        parts.push({ type, text });
      }
    }
  }
  return parts;
}

function extractParts(payload, fallbackText) {
  const candidateArrays = [
    payload?.parts,
    payload?.body?.parts,
    payload?.data?.parts,
    payload?.inputs?.parts,
  ];

  if (Array.isArray(payload?.messages)) {
    for (const msg of payload.messages) {
      if (Array.isArray(msg?.parts)) candidateArrays.push(msg.parts);
      if (Array.isArray(msg?.content)) candidateArrays.push(msg.content);
    }
  }

  for (const candidate of candidateArrays) {
    const normalized = normalizePartsArray(candidate);
    if (normalized.length) return normalized;
  }

  if (fallbackText) {
    return [{ type: 'text', text: fallbackText }];
  }
  return [];
}

function pickStringDeep(payload, keys, fallback) {
  const containers = [payload, payload?.inputs, payload?.body, payload?.data];
  for (const container of containers) {
    if (!container || typeof container !== 'object') continue;
    for (const key of keys) {
      const value = container[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
    }
  }
  return fallback;
}

// HTTP 요청 헬퍼 함수
function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpLib = isHttps ? https : http;
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + (urlObj.search || ''),
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const timeoutMs = options.timeoutMs ?? 30000;
    const req = httpLib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          data: data,
          json: () => (data ? JSON.parse(data) : {})
        });
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request to ${urlObj.hostname} timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// SSE 이벤트 스트림을 통해 메시지 완료 대기
function waitForMessageComplete(sessionId, authHeader, timeoutMs = MESSAGE_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(`${OPENCODE_BASE}/event`);
    const isHttps = urlObj.protocol === 'https:';
    const httpLib = isHttps ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    };
    if (authHeader) {
      reqOptions.headers['Authorization'] = authHeader;
    }

    let buffer = '';
    let assistantText = '';
    let messageId = null;
    let assistantFinished = false;
    let completed = false;
    let timeoutHandle = null;
    let req = null;

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (req) {
        req.destroy();
        req = null;
      }
    };

    const finishWithResult = () => {
      if (completed) return;
      completed = true;
      cleanup();
      // 앞뒤 공백/줄바꿈 정리
      const cleanText = assistantText.trim();
      resolve({ text: cleanText, messageId, timedOut: false });
    };

    timeoutHandle = setTimeout(() => {
      cleanup();
      if (!completed) {
        const cleanText = assistantText.trim();
        if (cleanText) {
          resolve({ text: cleanText, messageId, timedOut: true });
        } else {
          reject(new Error(`Message response timed out after ${timeoutMs}ms`));
        }
      }
    }, timeoutMs);

    req = httpLib.request(reqOptions, (res) => {
      res.setEncoding('utf8');
      
      res.on('data', (chunk) => {
        buffer += chunk;
        
        // SSE 이벤트 파싱
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            
            try {
              const event = JSON.parse(jsonStr);
              const props = event.properties || {};
              
              // 세션 관련 이벤트만 처리
              if (props.sessionID !== sessionId && props.info?.sessionID !== sessionId && props.part?.sessionID !== sessionId) {
                continue;
              }
              
              // 텍스트 청크 수집 (message.part.updated의 delta)
              if (event.type === 'message.part.updated') {
                const part = props.part;
                if (part?.type === 'text' && props.delta) {
                  assistantText += props.delta;
                }
              }
              
              // assistant 메시지 완료 감지 (finish 필드 존재)
              if (event.type === 'message.updated') {
                const info = props.info;
                if (info?.role === 'assistant' && info?.sessionID === sessionId) {
                  messageId = info.id;
                  if (info.finish) {
                    assistantFinished = true;
                  }
                }
              }
              
              // 세션 idle 이벤트 = 모든 처리 완료
              if (event.type === 'session.idle' && props.sessionID === sessionId) {
                if (assistantFinished && assistantText) {
                  finishWithResult();
                  return;
                }
              }
              
            } catch (e) {
              // JSON 파싱 실패는 무시
            }
          }
        }
      });
      
      res.on('end', () => {
        cleanup();
        if (!completed) {
          const cleanText = assistantText.trim();
          if (cleanText) {
            resolve({ text: cleanText, messageId, timedOut: false });
          } else {
            reject(new Error('SSE stream ended without complete response'));
          }
        }
      });
      
      res.on('error', (err) => {
        cleanup();
        if (!completed) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      cleanup();
      if (!completed) {
        reject(err);
      }
    });

    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const requestTime = new Date().toISOString();
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;
  const queryParams = Object.fromEntries(requestUrl.searchParams.entries());
  console.log(`[${requestTime}] ${req.method} ${requestUrl.pathname}${requestUrl.search} - Start`);
  
  // CORS 헤더 추가
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    console.log(`[${requestTime}] OPTIONS request - Sending 204`);
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.method === 'GET' && pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      tokenReady: tokenFileReady,
      hasToken: !!cachedStaticBearer,
      time: requestTime
    }));
    return;
  }

  // Status endpoint
  if (req.method === 'GET' && pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok',
      tokenReady: tokenFileReady,
      hasToken: !!cachedStaticBearer,
      opencodeBase: OPENCODE_BASE,
      defaultProvider: DEFAULT_PROVIDER,
      defaultModel: DEFAULT_MODEL,
      time: requestTime
    }));
    return;
  }

  if (req.method !== 'POST' || pathname !== '/auto-chat') {
    console.log(`[${requestTime}] Invalid request: ${req.method} ${req.url} - Sending 404`);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found. Use POST /auto-chat' }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    let data;
    try {
      data = body ? JSON.parse(body) : {};
    } catch (parseErr) {
      console.log(`[${requestTime}] Error: invalid JSON body`);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid JSON', detail: parseErr.message }));
      return;
    }

    try {
      if (Object.keys(queryParams).length) {
        data = mergeQueryParams(data, queryParams);
      }
      console.log(`[${requestTime}] Request body: ${body}`);

      const title = pickStringDeep(data, ['title', 'sessionTitle'], DEFAULT_SESSION_TITLE);
      const providerID = pickStringDeep(data, ['providerID', 'providerId', 'provider'], DEFAULT_PROVIDER);
      const modelID = pickStringDeep(data, ['modelID', 'modelId', 'model'], DEFAULT_MODEL);
      const messageText = extractMessage(data);
      const parts = extractParts(data, messageText);

      console.log(`[${requestTime}] Parsed data:`, {
        title,
        providerID,
        modelID,
        messageLength: (messageText || parts[0]?.text || '').length,
        partsCount: parts.length,
      });

      if (!parts.length) {
        console.log(`[${requestTime}] Error: message or parts required`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'message text required' }));
        return;
      }

      const clientAuthHeader = (req.headers['authorization'] || '').trim();
      let upstreamAuthHeader = clientAuthHeader;
      if (!upstreamAuthHeader && STATIC_BEARER) {
        upstreamAuthHeader = STATIC_BEARER.startsWith('Bearer ') ? STATIC_BEARER : `Bearer ${STATIC_BEARER}`;
      }
      if (REQUIRE_CLIENT_AUTH && !clientAuthHeader) {
        console.log(`[${requestTime}] Missing client Authorization and REQUIRE_CLIENT_AUTH enabled`);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authorization required' }));
        return;
      }
      console.log(`[${requestTime}] Auth header present: ${!!clientAuthHeader}, upstream auth applied: ${!!upstreamAuthHeader}`);

      // 1. 세션 생성
      console.log(`[${requestTime}] Creating session at ${OPENCODE_BASE}/session`);
      const sessionRes = await httpRequest(
        `${OPENCODE_BASE}/session`,
        {
          method: 'POST',
          headers: (() => {
            const headers = { 'Content-Type': 'application/json' };
            if (upstreamAuthHeader) headers['Authorization'] = upstreamAuthHeader;
            return headers;
          })()
        },
        JSON.stringify({ title })
      );

      console.log(`[${requestTime}] Session creation response: ${sessionRes.status}`);
      if (!sessionRes.ok) {
        console.log(`[${requestTime}] Session creation failed: ${sessionRes.data}`);
        throw new Error(`Session creation failed: ${sessionRes.status}`);
      }

      const session = sessionRes.json();
      const sessionId = session.id;
      console.log(`[${requestTime}] Session created: ${sessionId}`);

      // 2. 이벤트 스트림 연결 시작 (메시지 전송 전에!)
      console.log(`[${requestTime}] Starting SSE listener for session ${sessionId}`);
      const eventPromise = waitForMessageComplete(sessionId, upstreamAuthHeader, MESSAGE_TIMEOUT);

      // 3. 메시지 전송 (이벤트 리스너가 준비된 후)
      // 약간의 지연을 두어 SSE 연결이 설정되도록 함
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`[${requestTime}] Sending message to session ${sessionId}`);
      const messageRes = await httpRequest(
        `${OPENCODE_BASE}/session/${sessionId}/message`,
        {
          method: 'POST',
          headers: (() => {
            const headers = { 'Content-Type': 'application/json' };
            if (upstreamAuthHeader) headers['Authorization'] = upstreamAuthHeader;
            return headers;
          })()
        },
        JSON.stringify({
          providerID,
          modelID,
          parts,
        })
      );

      console.log(`[${requestTime}] Message sending response: ${messageRes.status}`);
      if (!messageRes.ok) {
        console.log(`[${requestTime}] Message sending failed: ${messageRes.data}`);
        throw new Error(`Message sending failed: ${messageRes.status}`);
      }

      // 4. SSE를 통해 응답 완료 대기
      console.log(`[${requestTime}] Waiting for response via SSE...`);
      const result = await eventPromise;
      
      console.log(`[${requestTime}] Success - Session: ${sessionId}, Response length: ${result.text.length}, TimedOut: ${result.timedOut}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        sessionId,
        messageId: result.messageId,
        response: {
          text: result.text,
          timedOut: result.timedOut
        }
      }));

    } catch (err) {
      console.error(`[${requestTime}] Error:`, err.message);
      console.error(`[${requestTime}] Stack:`, err.stack);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message, stack: err.stack }));
    }
  });
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[STARTUP] Auto-chat proxy starting on port ${PORT}`);
  console.log(`[STARTUP] OPENCODE_BASE: ${OPENCODE_BASE}`);
  console.log(`[STARTUP] DEFAULT_PROVIDER: ${DEFAULT_PROVIDER}`);
  console.log(`[STARTUP] DEFAULT_MODEL: ${DEFAULT_MODEL}`);
  console.log(`[STARTUP] MESSAGE_TIMEOUT: ${MESSAGE_TIMEOUT}ms`);
  console.log(`[STARTUP] TOKEN_FILE: ${STATIC_BEARER_FILE || '(none)'}`);
  console.log(`[STARTUP] Time: ${new Date().toISOString()}`);
  
  // Wait for token file if configured
  if (STATIC_BEARER_FILE) {
    await waitForTokenFile();
  }
  
  console.log(`[STARTUP] Auto-chat proxy ready!`);
});
