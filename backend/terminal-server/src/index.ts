/**
 * Terminal Server - Main Entry Point
 *
 * Accepts WebSocket upgrades from terminal-gateway, validates short-lived
 * admission tokens, and tracks live ownership in an in-memory or Redis session
 * store before spawning Docker-backed PTY containers.
 */

import http from 'http';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { startContainer, stopContainer, cleanupStaleContainers } from './docker.js';
import { createPtyBridge, parseTerminalSize } from './pty-bridge.js';
import {
  INTERNAL_AUTH_HEADER,
  verifyAdmissionToken,
  verifyInternalRequest,
} from './admission.js';
import { createSessionStore, type SessionStore } from './session-store.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const TERMINAL_SESSION_SECRET = process.env.TERMINAL_SESSION_SECRET;
const SESSION_TIMEOUT = parseInt(
  process.env.TERMINAL_SESSION_TIMEOUT_MS || process.env.SESSION_TIMEOUT || String(10 * 60 * 1000),
  10,
);
const SESSION_TTL_SECONDS = Math.max(60, Math.ceil(SESSION_TIMEOUT / 1000));

if (!TERMINAL_SESSION_SECRET) {
  console.error('TERMINAL_SESSION_SECRET environment variable is required');
  process.exit(1);
}
const terminalSessionSecret = TERMINAL_SESSION_SECRET;

interface Session {
  sessionId: string;
  userId: string;
  requestId: string;
  clientIP: string;
  containerName: string;
  ws: WebSocket;
  timeout: NodeJS.Timeout;
  createdAt: number;
}

const sessions = new Map<string, Session>();
let sessionStore: SessionStore;

async function cleanupSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) {
    return;
  }

  sessions.delete(sessionId);
  clearTimeout(session.timeout);

  try {
    await stopContainer(session.containerName);
  } catch (err) {
    console.error(`[${session.requestId}] Failed to stop container`, err);
  }

  try {
    await sessionStore.releaseSession(sessionId, session.userId);
  } catch (err) {
    console.error(`[${session.requestId}] Failed to release session`, err);
  }

  console.log(`[${session.requestId}] Session cleaned up`);
}

function createHttpServer() {
  return http.createServer(async (req, res) => {
    if (req.url === '/health') {
      const storeHealth = await sessionStore.health().catch((err) => ({
        ok: false,
        error: String(err),
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          sessions: sessions.size,
          store: storeHealth,
          uptime: process.uptime(),
        }),
      );
      return;
    }

    if (req.url === '/stats') {
      if (
        !verifyInternalRequest({
          headerValue: req.headers[INTERNAL_AUTH_HEADER],
          secret: terminalSessionSecret,
          method: req.method || 'GET',
          path: '/stats',
        })
      ) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const liveSessions = Array.from(sessions.values()).map((session) => ({
        sessionId: session.sessionId,
        userId: session.userId,
        clientIP: session.clientIP,
        containerName: session.containerName,
        uptimeMs: Date.now() - session.createdAt,
      }));
      const storeSessions = await sessionStore.listSessions().catch(() => []);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ liveSessions, storeSessions }));
      return;
    }

    if (req.url === '/execute' || req.url === '/execute/') {
      res.writeHead(410, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: false,
          error:
            'Code execution moved to backend /api/v1/execute. terminal-server only handles /terminal.',
        }),
      );
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

      const admissionToken = request.headers['x-terminal-admission'];
      const clientIP = request.headers['x-client-ip'];
      const clientUserAgent = request.headers['x-client-user-agent'];
      const requestId =
        (request.headers['x-request-id'] as string | undefined) || crypto.randomUUID();

      if (typeof admissionToken !== 'string') {
        console.warn('Unauthorized connection attempt - missing admission token');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      if (typeof clientIP !== 'string' || typeof clientUserAgent !== 'string') {
        console.warn('Unauthorized connection attempt - missing client binding headers');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const admission = verifyAdmissionToken({
        token: admissionToken,
        secret: terminalSessionSecret,
        clientIP,
        userAgent: clientUserAgent,
      });

      if (!admission?.sub || !admission.jti) {
        console.warn('Unauthorized connection attempt - invalid admission token');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const sessionId = admission.jti;
      const claimResult = await sessionStore.claimSession(
        {
          sessionId,
          userId: admission.sub,
          clientIP,
          email: admission.email || null,
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

      console.log(`[${requestId}] WebSocket upgrade for user: ${admission.sub} from ${clientIP}`);

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, {
          sessionId,
          userId: admission.sub,
          clientIP,
          requestId,
          url,
        });
      });
    })().catch((err) => {
      console.error('Upgrade handling failed:', err);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    });
  });

  wss.on(
    'connection',
    async (
      ws: WebSocket,
      request: http.IncomingMessage,
      context: { sessionId: string; userId: string; clientIP: string; requestId: string; url: URL },
    ) => {
      const { sessionId, userId, clientIP, requestId, url } = context;
      console.log(`[${requestId}] Connection established for user: ${userId}`);

      const { cols, rows } = parseTerminalSize(url);

      try {
        const { containerName, args } = startContainer(userId);
        console.log(`[${requestId}] Starting container: ${containerName}`);

        await sessionStore.markConnected(sessionId, userId, containerName, SESSION_TTL_SECONDS);

        ws.send(`\x1b[32m[Connected to sandbox terminal]\x1b[0m\r\n`);
        ws.send(`\x1b[90mContainer: ${containerName}\x1b[0m\r\n`);
        ws.send(`\x1b[90mTimeout: ${SESSION_TIMEOUT / 1000}s\x1b[0m\r\n\r\n`);

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
        }, SESSION_TIMEOUT);

        sessions.set(sessionId, {
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
      } catch (err) {
        console.error(`[${requestId}] Failed to bootstrap terminal session:`, err);
        ws.close(1011, 'Terminal bootstrap failed');
        await sessionStore.releaseSession(sessionId, userId).catch(() => {});
      }
    },
  );

  setInterval(async () => {
    const cleaned = await cleanupStaleContainers(SESSION_TIMEOUT);
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} stale containers`);
    }
  }, 60 * 1000);

  const shutdown = async () => {
    console.log('Shutting down...');

    for (const [sessionId, session] of sessions) {
      clearTimeout(session.timeout);
      session.ws.close(1001, 'Server shutting down');
      await stopContainer(session.containerName).catch((err) => {
        console.error(`Failed to stop container for ${sessionId}`, err);
      });
      await sessionStore.releaseSession(sessionId, session.userId).catch((err) => {
        console.error(`Failed to release session for ${sessionId}`, err);
      });
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
    console.log(`Session timeout: ${SESSION_TIMEOUT / 1000}s`);
    console.log(`Session store: ${sessionStore.kind}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap terminal server', err);
  process.exit(1);
});
