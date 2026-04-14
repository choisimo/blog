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
  createInternalAuthHeader,
  verifyAdmissionToken,
  verifyInternalRequest,
} from './admission.js';

// Configuration
const PORT = parseInt(process.env.PORT || '8080', 10);
const TERMINAL_SESSION_SECRET = process.env.TERMINAL_SESSION_SECRET;
const TERMINAL_GATEWAY_URL =
  process.env.TERMINAL_GATEWAY_INTERNAL_ORIGIN || process.env.TERMINAL_GATEWAY_URL || '';
const SESSION_TIMEOUT = parseInt(
  process.env.TERMINAL_SESSION_TIMEOUT_MS || process.env.SESSION_TIMEOUT || String(10 * 60 * 1000),
  10
); // 10 minutes default
const LEASE_HEARTBEAT_INTERVAL_MS = parseInt(
  process.env.TERMINAL_LEASE_HEARTBEAT_MS || '30000',
  10
);
const LEASE_HEARTBEAT_FAILURE_THRESHOLD = 2;

if (!TERMINAL_SESSION_SECRET) {
  console.error('TERMINAL_SESSION_SECRET environment variable is required');
  process.exit(1);
}

const terminalSessionSecret = TERMINAL_SESSION_SECRET;

// Track active sessions for cleanup
interface Session {
  userId: string;
  leaseId: string;
  containerName: string;
  ws: WebSocket;
  timeout: NodeJS.Timeout;
  heartbeat: NodeJS.Timeout | null;
  createdAt: number;
}

const sessions = new Map<string, Session>();

function normalizeLeaseGatewayUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  return value
    .replace(/^wss:\/\//, 'https://')
    .replace(/^ws:\/\//, 'http://')
    .replace(/\/$/, '');
}

const leaseGatewayBaseUrl = normalizeLeaseGatewayUrl(TERMINAL_GATEWAY_URL);

if (!leaseGatewayBaseUrl) {
  console.warn(
    'TERMINAL_GATEWAY_URL or TERMINAL_GATEWAY_INTERNAL_ORIGIN is not configured; terminal lease sync will fail closed'
  );
}

async function postLeaseEvent(action: 'open' | 'heartbeat' | 'close', input: {
  userId: string;
  leaseId: string;
}): Promise<void> {
  if (!leaseGatewayBaseUrl) {
    throw new Error('TERMINAL_GATEWAY_URL or TERMINAL_GATEWAY_INTERNAL_ORIGIN is required');
  }

  const path = `/internal/leases/${action}`;
  const response = await fetch(`${leaseGatewayBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [INTERNAL_AUTH_HEADER]: createInternalAuthHeader(
        terminalSessionSecret,
        'POST',
        path
      ),
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(2_000),
  });

  if (response.ok || response.status === 204) {
    return;
  }

  const message = await response.text().catch(() => '');
  throw new Error(
    `Lease ${action} failed with status ${response.status}${message ? `: ${message}` : ''}`
  );
}

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
        secret: terminalSessionSecret,
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
    secret: terminalSessionSecret,
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
  async (
    ws: WebSocket,
    request: http.IncomingMessage,
    context: { userId: string; clientIP: string; requestId: string; url: URL }
  ) => {
    const { userId, clientIP, requestId, url } = context;
    console.log(`[${requestId}] Connection established for user: ${userId}`);

    // Parse terminal size from query params
    const { cols, rows } = parseTerminalSize(url);

    try {
      await postLeaseEvent('open', {
        userId,
        leaseId: requestId,
      });
    } catch (err) {
      console.error(`[${requestId}] Failed to open authoritative lease:`, err);
      try {
        await postLeaseEvent('close', {
          userId,
          leaseId: requestId,
        });
      } catch (closeErr) {
        console.warn(`[${requestId}] Failed to roll back lease after open error:`, closeErr);
      }
      ws.close(1011, 'Lease sync failed');
      return;
    }

    // Start Docker container
    const { containerName, args } = startContainer(userId);
    console.log(`[${requestId}] Starting container: ${containerName}`);

    let cleanedUp = false;
    let heartbeatFailures = 0;
    let heartbeat: NodeJS.Timeout | null = null;
    let bridge: ReturnType<typeof createPtyBridge> | null = null;

    const cleanupSession = async (id: string) => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;

      const s = sessions.get(id);
      if (s) {
        clearTimeout(s.timeout);
        if (s.heartbeat) {
          clearInterval(s.heartbeat);
        }
        sessions.delete(id);
      }

      try {
        await postLeaseEvent('close', {
          userId,
          leaseId: requestId,
        });
      } catch (err) {
        console.warn(`[${id}] Failed to release authoritative lease:`, err);
      }

      await stopContainer(containerName);
      console.log(`[${id}] Session cleaned up`);
    };

    // Send welcome message
    ws.send(`\x1b[32m[Connected to sandbox terminal]\x1b[0m\r\n`);
    ws.send(`\x1b[90mContainer: ${containerName}\x1b[0m\r\n`);
    ws.send(`\x1b[90mTimeout: ${SESSION_TIMEOUT / 1000}s\x1b[0m\r\n\r\n`);

    // Create PTY bridge
    bridge = createPtyBridge(ws, 'docker', args, {
      cols,
      rows,
      onExit: (code) => {
        console.log(`[${requestId}] Container exited with code: ${code}`);
        void cleanupSession(requestId);
      },
    });

    // Session timeout
    const timeout = setTimeout(() => {
      console.log(`[${requestId}] Session timeout for user: ${userId}`);
      ws.send('\r\n\x1b[31m[Session timeout - disconnecting...]\x1b[0m\r\n');

      setTimeout(() => {
        bridge?.kill();
        ws.close(1000, 'Session timeout');
      }, 1000);
    }, SESSION_TIMEOUT);

    heartbeat = setInterval(async () => {
      try {
        await postLeaseEvent('heartbeat', {
          userId,
          leaseId: requestId,
        });
        heartbeatFailures = 0;
      } catch (err) {
        heartbeatFailures += 1;
        console.warn(
          `[${requestId}] Failed to heartbeat authoritative lease (${heartbeatFailures}/${LEASE_HEARTBEAT_FAILURE_THRESHOLD}):`,
          err
        );
        if (heartbeatFailures >= LEASE_HEARTBEAT_FAILURE_THRESHOLD) {
          ws.send('\r\n\x1b[31m[Terminal lease sync lost - disconnecting...]\x1b[0m\r\n');
          ws.close(1011, 'Lease heartbeat failed');
        }
      }
    }, LEASE_HEARTBEAT_INTERVAL_MS);

    // Track session
    const session: Session = {
      userId,
      leaseId: requestId,
      containerName,
      ws,
      timeout,
      heartbeat,
      createdAt: Date.now(),
    };
    sessions.set(requestId, session);

    // Handle WebSocket close
    ws.on('close', () => {
      console.log(`[${requestId}] WebSocket closed`);
      void cleanupSession(requestId);
    });

    // Handle WebSocket error
    ws.on('error', (err) => {
      console.error(`[${requestId}] WebSocket error:`, err);
      void cleanupSession(requestId);
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
    if (session.heartbeat) {
      clearInterval(session.heartbeat);
    }
    session.ws.close(1001, 'Server shutting down');
    try {
      await postLeaseEvent('close', {
        userId: session.userId,
        leaseId: session.leaseId,
      });
    } catch (err) {
      console.warn(`Failed to release lease during shutdown for ${id}:`, err);
    }
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
