/**
 * Terminal Server - Main Entry Point
 *
 * Receives WebSocket upgrades only from terminal-gateway, validates a
 * short-lived admission token, claims external session ownership, and then
 * starts a Docker-backed PTY sandbox.
 */

import http from 'http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { startContainer, stopContainer, cleanupStaleContainers } from './docker.js';
import { createPtyBridge, parseTerminalSize } from './pty-bridge.js';
import { verifyTerminalAdmissionToken } from './auth.js';
import { createSessionStore, type SessionStore } from './session-store.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const TERMINAL_SESSION_SECRET = process.env.TERMINAL_SESSION_SECRET;
const SESSION_TIMEOUT_MS = parseInt(
  process.env.TERMINAL_SESSION_TIMEOUT_MS || process.env.SESSION_TIMEOUT || String(10 * 60 * 1000),
  10,
);
const SESSION_TTL_SECONDS = Math.max(60, Math.ceil(SESSION_TIMEOUT_MS / 1000));

if (!TERMINAL_SESSION_SECRET) {
  console.error('TERMINAL_SESSION_SECRET environment variable is required');
  process.exit(1);
}

interface LiveSession {
  sessionId: string;
  userId: string;
  requestId: string;
  clientIP: string;
  containerName: string;
  ws: WebSocket;
  timeout: NodeJS.Timeout;
  createdAt: number;
}

const liveSessions = new Map<string, LiveSession>();
let sessionStore: SessionStore;

function getClientIP(request: http.IncomingMessage): string {
  const xClientIp = request.headers['x-client-ip'];
  if (typeof xClientIp === 'string' && xClientIp) return xClientIp;
  const xForwardedFor = request.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string' && xForwardedFor) {
    return xForwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  return request.socket.remoteAddress || 'unknown';
}

async function cleanupSession(sessionId: string) {
  const session = liveSessions.get(sessionId);
  if (!session) return;
  liveSessions.delete(sessionId);
  clearTimeout(session.timeout);
  try {
    await stopContainer(session.containerName);
  } catch (err) {
    console.error(`[${session.requestId}] Failed to stop container`, err);
  }
  try {
    await sessionStore.releaseSession(sessionId, session.userId);
  } catch (err) {
    console.error(`[${session.requestId}] Failed to release session store lease`, err);
  }
  console.log(`[${session.requestId}] Session cleaned up`);
}

function createHttpServer() {
  return http.createServer(async (req, res) => {
    if (req.url === '/health') {
      const storeHealth = await sessionStore.health().catch((err) => ({ ok: false, error: String(err) }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          sessions: liveSessions.size,
          store: storeHealth,
          uptime: process.uptime(),
        }),
      );
      return;
    }

    if (req.url === '/stats') {
      const storeSessions = await sessionStore.listSessions().catch(() => []);
      const liveSessionList = Array.from(liveSessions.values()).map((session) => ({
        sessionId: session.sessionId,
        userId: session.userId,
        containerName: session.containerName,
        uptimeMs: Date.now() - session.createdAt,
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        liveSessions: liveSessionList,
        storeSessions,
      }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });
}

async function bootstrap() {
  sessionStore = await createSessionStore();
  await sessionStore.connect();

  const server = createHttpServer();
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    void (async () => {
      const url = new URL(request.url || '/', `http://${request.headers.host}`);

      if (url.pathname !== '/terminal' && url.pathname !== '/terminal/') {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      const tokenHeader = request.headers['x-terminal-session-token'];
      const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
      const clientIP = getClientIP(request);
      const requestIdHeader = request.headers['x-request-id'];
      const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader || randomUUID();

      const verification = verifyTerminalAdmissionToken(token || '', TERMINAL_SESSION_SECRET, {
        clientIP,
        userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : '',
      });

      if (!verification.ok) {
        console.warn(`[${requestId}] Unauthorized connection attempt: ${verification.error}`);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const claims = verification.claims;
      const claimResult = await sessionStore.claimSession(
        {
          sessionId: claims.sid,
          userId: claims.sub,
          clientIP,
          email: claims.email || null,
          requestId,
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          state: 'claimed',
        },
        SESSION_TTL_SECONDS,
      );

      if (!claimResult.ok) {
        console.warn(`[${requestId}] Session rejected: ${claimResult.reason}`);
        socket.write('HTTP/1.1 409 Conflict\r\n\r\n');
        socket.destroy();
        return;
      }

      console.log(`[${requestId}] WebSocket upgrade for user: ${claims.sub} from ${clientIP}`);

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, { claims, clientIP, requestId, url });
      });
    })().catch((err) => {
      console.error('Upgrade handling failed:', err);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    });
  });

  wss.on(
    'connection',
    (
      ws: WebSocket,
      request: http.IncomingMessage,
      context: {
        claims: { sid: string; sub: string };
        clientIP: string;
        requestId: string;
        url: URL;
      },
    ) => {
      const { claims, clientIP, requestId, url } = context;
      const sessionId = claims.sid;
      const userId = claims.sub;
      console.log(`[${requestId}] Connection established for user: ${userId}`);

      const { cols, rows } = parseTerminalSize(url);
      const { containerName, args } = startContainer(userId);
      console.log(`[${requestId}] Starting container: ${containerName}`);

      void sessionStore.markConnected(sessionId, userId, containerName, SESSION_TTL_SECONDS);

      ws.send(`\x1b[32m[Connected to sandbox terminal]\x1b[0m\r\n`);
      ws.send(`\x1b[90mContainer: ${containerName}\x1b[0m\r\n`);
      ws.send(`\x1b[90mTimeout: ${SESSION_TIMEOUT_MS / 1000}s\x1b[0m\r\n\r\n`);

      const bridge = createPtyBridge(ws, 'docker', args, {
        cols,
        rows,
        onData: () => {
          void sessionStore.touchSession(sessionId, userId, SESSION_TTL_SECONDS);
        },
        onExit: (code) => {
          console.log(`[${requestId}] Container exited with code: ${code}`);
          void cleanupSession(sessionId);
        },
      });

      const timeout = setTimeout(() => {
        console.log(`[${requestId}] Session timeout for user: ${userId}`);
        ws.send('\r\n\x1b[31m[Session timeout - disconnecting...]\x1b[0m\r\n');
        setTimeout(() => {
          bridge.kill();
          ws.close(1000, 'Session timeout');
        }, 1000);
      }, SESSION_TIMEOUT_MS);

      liveSessions.set(sessionId, {
        sessionId,
        userId,
        requestId,
        clientIP,
        containerName,
        ws,
        timeout,
        createdAt: Date.now(),
      });

      ws.on('close', () => {
        console.log(`[${requestId}] WebSocket closed`);
        void cleanupSession(sessionId);
      });

      ws.on('error', (err) => {
        console.error(`[${requestId}] WebSocket error:`, err);
        void cleanupSession(sessionId);
      });
    },
  );

  setInterval(async () => {
    const cleaned = await cleanupStaleContainers(SESSION_TIMEOUT_MS);
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} stale containers`);
    }
  }, 60 * 1000);

  const shutdown = async () => {
    console.log('Shutting down...');

    for (const [sessionId, session] of liveSessions) {
      clearTimeout(session.timeout);
      session.ws.close(1001, 'Server shutting down');
      await stopContainer(session.containerName);
      await sessionStore.releaseSession(sessionId, session.userId);
      console.log(`Closed session: ${sessionId}`);
    }

    await sessionStore.close().catch((err) => {
      console.error('Failed to close session store', err);
    });

    wss.close();
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  server.listen(PORT, () => {
    console.log(`Terminal server listening on port ${PORT}`);
    console.log(`Session timeout: ${SESSION_TIMEOUT_MS / 1000}s`);
    console.log(`Session store: ${sessionStore.kind}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap terminal server', err);
  process.exit(1);
});
