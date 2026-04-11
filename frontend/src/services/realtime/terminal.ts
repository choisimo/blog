/**
 * Terminal Service
 *
 * WebSocket-based real Linux terminal connection via gateway.
 *
 * Architecture:
 * Frontend -> Gateway -> Backend (terminal-server) -> Docker container
 */

import { useAuthStore } from '@/stores/session/useAuthStore';

type RuntimeWindow = Window & {
  APP_CONFIG?: {
    terminalGatewayUrl?: string | null;
  };
  __APP_CONFIG?: {
    terminalGatewayUrl?: string | null;
  };
};

// ============================================================================
// Types
// ============================================================================

export interface TerminalOptions {
  cols?: number;
  rows?: number;
  onOpen?: () => void;
  onData?: (data: string) => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (error: Event) => void;
}

export interface TerminalConnection {
  send: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  close: () => void;
  isConnected: () => boolean;
}

// ============================================================================
// Configuration
// ============================================================================

export function getTerminalGatewayUrl(): string | null {
  // Check localStorage override first (for development)
  try {
    const override = localStorage.getItem('aiMemo.terminalGatewayUrl');
    if (override) {
      const parsed = JSON.parse(override);
      if (typeof parsed === 'string' && parsed) return parsed;
    }
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    const runtimeWindow = window as RuntimeWindow;
    const runtimeUrl =
      runtimeWindow.APP_CONFIG?.terminalGatewayUrl ??
      runtimeWindow.__APP_CONFIG?.terminalGatewayUrl;
    if (typeof runtimeUrl === 'string' && runtimeUrl) {
      return runtimeUrl;
    }
  }

  // Environment variable (REQUIRED - no hardcoded fallback)
  const envUrl = import.meta.env.VITE_TERMINAL_GATEWAY_URL;
  if (typeof envUrl === 'string' && envUrl) {
    return envUrl;
  }

  return null;
}

function getAuthToken(): string | null {
  // Try Zustand store first
  const authToken = useAuthStore.getState().accessToken;
  if (authToken && authToken.trim()) {
    return authToken.trim();
  }

  // Fallback to localStorage
  if (typeof window === 'undefined') return null;
  const candidates = [
    'aiMemo.authToken',
    'aiMemo.jwt',
    'auth.token',
    'aiMemoAuthToken',
  ];

  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
        if (typeof raw === 'string' && raw.trim()) return raw.trim();
      }
    } catch {
      // ignore JSON parse errors
    }
  }

  return null;
}

function getTerminalHttpBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://').replace(/\/$/, '');
}

async function createTerminalSession(
  baseUrl: string,
  token: string,
  signal: AbortSignal
): Promise<void> {
  const response = await fetch(`${getTerminalHttpBaseUrl(baseUrl)}/session`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Terminal session bootstrap failed with status ${response.status}`);
  }
}

async function clearTerminalSession(baseUrl: string): Promise<void> {
  try {
    await fetch(`${getTerminalHttpBaseUrl(baseUrl)}/session`, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (error) {
    console.warn('[terminal] Failed to clear session cookie:', error);
  }
}

// ============================================================================
// Terminal Connection
// ============================================================================

/**
 * Connect to real Linux terminal via WebSocket
 *
 * @param options - Terminal options (size, callbacks)
 * @returns TerminalConnection object with send/resize/close methods
 *
 * @example
 * const term = connectTerminal({
 *   cols: 80,
 *   rows: 24,
 *   onData: (data) => console.log(data),
 *   onClose: (code, reason) => console.log('Closed:', code, reason),
 * });
 *
 * term.send('ls -la\n');
 * term.resize(120, 30);
 * term.close();
 */
export function connectTerminal(options: TerminalOptions = {}): TerminalConnection | null {
  const token = getAuthToken();
  if (!token) {
    console.error('[terminal] No auth token available');
    return null;
  }

  const baseUrl = getTerminalGatewayUrl();
  if (!baseUrl) {
    console.error('[terminal] Terminal gateway URL is not configured');
    return null;
  }
  const cols = options.cols || 80;
  const rows = options.rows || 24;

  // Build WebSocket URL with terminal size params only
  const url = new URL('/terminal', `${baseUrl.replace(/\/$/, '')}/`);
  url.searchParams.set('cols', String(cols));
  url.searchParams.set('rows', String(rows));

  let ws: WebSocket | null = null;
  let connected = false;
  let closed = false;
  let sessionEstablished = false;
  let sessionReleased = false;
  const connectAbortController = new AbortController();

  const releaseSession = () => {
    if (!sessionEstablished || sessionReleased) {
      return;
    }

    sessionReleased = true;
    void clearTerminalSession(baseUrl);
  };

  void (async () => {
    try {
      await createTerminalSession(baseUrl, token, connectAbortController.signal);
      sessionEstablished = true;

      if (closed) {
        releaseSession();
        return;
      }

      ws = new WebSocket(url.toString());
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        connected = true;
        releaseSession();
        console.log('[terminal] Connected');
        options.onOpen?.();
      };

      ws.onmessage = (event) => {
        let data: string;
        if (typeof event.data === 'string') {
          data = event.data;
        } else if (event.data instanceof ArrayBuffer) {
          data = new TextDecoder().decode(event.data);
        } else {
          return;
        }
        options.onData?.(data);
      };

      ws.onclose = (event) => {
        connected = false;
        ws = null;
        releaseSession();
        console.log('[terminal] Disconnected:', event.code, event.reason);
        options.onClose?.(event.code, event.reason);
      };

      ws.onerror = (error) => {
        releaseSession();
        console.error('[terminal] Error:', error);
        options.onError?.(error);
      };
    } catch (err) {
      releaseSession();
      if (connectAbortController.signal.aborted || closed) {
        return;
      }

      console.error('[terminal] Failed to connect:', err);
      options.onError?.(new Event('error'));
    }
  })();

  return {
    send: (data: string) => {
      if (ws && connected && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    },
    resize: (newCols: number, newRows: number) => {
      if (ws && connected && ws.readyState === WebSocket.OPEN) {
        // Send resize command (JSON protocol)
        ws.send(JSON.stringify({ type: 'resize', cols: newCols, rows: newRows }));
      }
    },
    close: () => {
      closed = true;
      connectAbortController.abort();
      if (ws) {
        ws.close(1000, 'Client closed');
        ws = null;
        connected = false;
      } else {
        releaseSession();
      }
    },
    isConnected: () => connected,
  };
}

/**
 * Check if terminal service is available
 */
export async function checkTerminalHealth(): Promise<boolean> {
  try {
    const terminalGatewayUrl = getTerminalGatewayUrl();
    if (!terminalGatewayUrl) return false;
    const baseUrl = getTerminalHttpBaseUrl(terminalGatewayUrl);
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Check if user has an active terminal session
 */
export function hasAuthToken(): boolean {
  return !!getAuthToken();
}

export function hasTerminalGatewayUrl(): boolean {
  return Boolean(getTerminalGatewayUrl());
}
