/**
 * Terminal Server - Main Entry Point
 *
 * HTTP + WebSocket server that handles terminal connections from a gateway.
 * Only accepts connections with valid Origin Secret.
 *
 * Features:
 * - WebSocket upgrade handling with secret verification
 * - Docker container spawning per session
 * - PTY bridge for terminal I/O
 * - Session timeout management
 * - Graceful shutdown
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

// Configuration
const PORT = parseInt(process.env.PORT || '8080', 10);
const TERMINAL_SESSION_SECRET = process.env.TERMINAL_SESSION_SECRET;
const SESSION_TIMEOUT = parseInt(
  process.env.TERMINAL_SESSION_TIMEOUT_MS || process.env.SESSION_TIMEOUT || String(10 * 60 * 1000),
  10
); // 10 minutes default

if (!TERMINAL_SESSION_SECRET) {
  console.error('TERMINAL_SESSION_SECRET environment variable is required');
  process.exit(1);
}

// Track active sessions for cleanup
interface Session {
  userId: string;
  containerName: string;
  ws: WebSocket;
  timeout: NodeJS.Timeout;
  createdAt: number;
}

const sessions = new Map<string, Session>();

// Create HTTP server
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        sessions: sessions.size,
        uptime: process.uptime(),
      })
    );
    return;
  }

  // Stats endpoint
  if (req.url === '/stats') {
    if (
      !verifyInternalRequest({
        headerValue: req.headers[INTERNAL_AUTH_HEADER],
        secret: TERMINAL_SESSION_SECRET,
        method: req.method || 'GET',
        path: '/stats',
      })
    ) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const sessionList = Array.from(sessions.values()).map((s) => ({
      userId: s.userId,
      containerName: s.containerName,
      uptime: Date.now() - s.createdAt,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessions: sessionList }));
    return;
  }

  if (req.url === '/execute' || req.url === '/execute/') {
    res.writeHead(410, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: false,
        error: 'Code execution moved to backend /api/v1/execute. terminal-server only handles /terminal.',
      })
    );
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// Create WebSocket server (no automatic handling - we do manual upgrade)
const wss = new WebSocketServer({ noServer: true });

// Handle HTTP upgrade to WebSocket
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);

  // Only handle /terminal path
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
    secret: TERMINAL_SESSION_SECRET,
    clientIP,
    userAgent: clientUserAgent,
  });

  if (!admission?.sub) {
    console.warn('Unauthorized connection attempt - invalid admission token');
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  const userId = admission.sub;

  console.log(`[${requestId}] WebSocket upgrade for user: ${userId} from ${clientIP}`);

  // Handle WebSocket upgrade
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, { userId, clientIP, requestId, url });
  });
});

// Handle WebSocket connections
wss.on(
  'connection',
  (
    ws: WebSocket,
    request: http.IncomingMessage,
    context: { userId: string; clientIP: string; requestId: string; url: URL }
  ) => {
    const { userId, clientIP, requestId, url } = context;
    console.log(`[${requestId}] Connection established for user: ${userId}`);

    // Parse terminal size from query params
    const { cols, rows } = parseTerminalSize(url);

    // Start Docker container
    const { containerName, args } = startContainer(userId);
    console.log(`[${requestId}] Starting container: ${containerName}`);

    // Send welcome message
    ws.send(`\x1b[32m[Connected to sandbox terminal]\x1b[0m\r\n`);
    ws.send(`\x1b[90mContainer: ${containerName}\x1b[0m\r\n`);
    ws.send(`\x1b[90mTimeout: ${SESSION_TIMEOUT / 1000}s\x1b[0m\r\n\r\n`);

    // Create PTY bridge
    const bridge = createPtyBridge(ws, 'docker', args, {
      cols,
      rows,
      onExit: (code) => {
        console.log(`[${requestId}] Container exited with code: ${code}`);
        cleanupSession(requestId);
      },
    });

    // Session timeout
    const timeout = setTimeout(() => {
      console.log(`[${requestId}] Session timeout for user: ${userId}`);
      ws.send('\r\n\x1b[31m[Session timeout - disconnecting...]\x1b[0m\r\n');

      setTimeout(() => {
        bridge.kill();
        ws.close(1000, 'Session timeout');
      }, 1000);
    }, SESSION_TIMEOUT);

    // Track session
    const session: Session = {
      userId,
      containerName,
      ws,
      timeout,
      createdAt: Date.now(),
    };
    sessions.set(requestId, session);

    // Cleanup function
    const cleanupSession = async (id: string) => {
      const s = sessions.get(id);
      if (s) {
        clearTimeout(s.timeout);
        sessions.delete(id);
        await stopContainer(s.containerName);
        console.log(`[${id}] Session cleaned up`);
      }
    };

    // Handle WebSocket close
    ws.on('close', () => {
      console.log(`[${requestId}] WebSocket closed`);
      cleanupSession(requestId);
    });

    // Handle WebSocket error
    ws.on('error', (err) => {
      console.error(`[${requestId}] WebSocket error:`, err);
      cleanupSession(requestId);
    });
  }
);

// Periodic cleanup of stale containers
setInterval(async () => {
  const cleaned = await cleanupStaleContainers(SESSION_TIMEOUT);
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} stale containers`);
  }
}, 60 * 1000); // Every minute

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down...');

  // Close all sessions
  for (const [id, session] of sessions) {
    clearTimeout(session.timeout);
    session.ws.close(1001, 'Server shutting down');
    await stopContainer(session.containerName);
    console.log(`Closed session: ${id}`);
  }

  wss.close();
  server.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
server.listen(PORT, () => {
  console.log(`Terminal server listening on port ${PORT}`);
  console.log(`Session timeout: ${SESSION_TIMEOUT / 1000}s`);
});
