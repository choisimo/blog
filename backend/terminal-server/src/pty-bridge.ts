/**
 * Terminal Server - PTY Bridge
 *
 * Bridges WebSocket connections to PTY (pseudo-terminal) sessions
 */

import type { WebSocket } from 'ws';
import type { IPty } from 'node-pty';

export interface PtyBridgeOptions {
  cols?: number;
  rows?: number;
  onData?: (data: string) => void;
  onExit?: (code: number) => void;
}

export interface PtyBridge {
  pty: IPty;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
}

/**
 * Create a PTY bridge for a WebSocket connection
 */
export function createPtyBridge(
  ws: WebSocket,
  command: string,
  args: string[],
  options: PtyBridgeOptions = {}
): PtyBridge {
  // Dynamic import node-pty (ESM compatibility)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pty = require('node-pty') as typeof import('node-pty');

  const cols = options.cols || 80;
  const rows = options.rows || 24;

  // Spawn PTY process
  const ptyProcess = pty.spawn(command, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: process.env.HOME || '/tmp',
    env: {
      ...process.env,
      TERM: 'xterm-256color',
    },
  });

  // PTY -> WebSocket
  ptyProcess.onData((data: string) => {
    try {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
      options.onData?.(data);
    } catch (err) {
      console.error('Error sending to WebSocket:', err);
    }
  });

  // PTY exit handler
  ptyProcess.onExit(({ exitCode }) => {
    console.log(`PTY exited with code: ${exitCode}`);
    options.onExit?.(exitCode);

    // Close WebSocket if still open
    if (ws.readyState === ws.OPEN) {
      ws.close(1000, 'Terminal session ended');
    }
  });

  // WebSocket -> PTY
  ws.on('message', (data: Buffer | string) => {
    try {
      const message = data.toString();

      // Handle resize messages (JSON format: {"type":"resize","cols":80,"rows":24})
      if (message.startsWith('{')) {
        try {
          const parsed = JSON.parse(message);
          if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
            ptyProcess.resize(parsed.cols, parsed.rows);
            return;
          }
        } catch {
          // Not JSON, treat as terminal input
        }
      }

      // Regular terminal input
      ptyProcess.write(message);
    } catch (err) {
      console.error('Error writing to PTY:', err);
    }
  });

  // WebSocket close handler
  ws.on('close', () => {
    console.log('WebSocket closed, killing PTY');
    ptyProcess.kill();
  });

  // WebSocket error handler
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    ptyProcess.kill();
  });

  return {
    pty: ptyProcess,
    write: (data: string) => ptyProcess.write(data),
    resize: (cols: number, rows: number) => ptyProcess.resize(cols, rows),
    kill: () => ptyProcess.kill(),
  };
}

/**
 * Parse terminal size from query string
 */
export function parseTerminalSize(url: URL): { cols: number; rows: number } {
  const cols = parseInt(url.searchParams.get('cols') || '80', 10);
  const rows = parseInt(url.searchParams.get('rows') || '24', 10);

  return {
    cols: Math.min(Math.max(cols, 20), 500), // Clamp between 20-500
    rows: Math.min(Math.max(rows, 5), 100), // Clamp between 5-100
  };
}
