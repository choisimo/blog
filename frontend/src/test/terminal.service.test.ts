import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connectTerminal, getTerminalGatewayUrl } from '@/services/realtime/terminal';
import { cancelTokenRefresh, useAuthStore } from '@/stores/session/useAuthStore';

function createToken(expiresInSeconds = 3600) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  return `${header}.${payload}.signature`;
}

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  binaryType: BinaryType = 'blob';
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  send = vi.fn();

  constructor(url: string | URL) {
    this.url = String(url);
    MockWebSocket.instances.push(this);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({
      code: code ?? 1000,
      reason: reason ?? '',
    } as CloseEvent);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }
}

describe('terminal service security hardening', () => {
  const originalFetch = global.fetch;
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    cancelTokenRefresh();
    localStorage.clear();
    sessionStorage.clear();
    act(() => {
      useAuthStore.getState().clearAuth();
    });

    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    (window as Window & {
      APP_CONFIG?: {
        terminalGatewayUrl?: string | null;
        features?: { terminalEnabled?: boolean };
      };
      __APP_CONFIG?: {
        terminalGatewayUrl?: string | null;
        features?: { terminalEnabled?: boolean };
      };
    }).APP_CONFIG = {
      terminalGatewayUrl: 'wss://terminal.nodove.com',
      features: {
        terminalEnabled: true,
      },
    };
    delete (window as Window & { __APP_CONFIG?: unknown }).__APP_CONFIG;
  });

  afterEach(() => {
    cancelTokenRefresh();
    act(() => {
      useAuthStore.getState().clearAuth();
    });
    localStorage.clear();
    sessionStorage.clear();
    global.fetch = originalFetch;
    globalThis.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  it('bootstraps a server-set session before opening the terminal websocket', async () => {
    const accessToken = createToken();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url === 'https://terminal.nodove.com/session' && init?.method === 'POST') {
        return new Response(null, { status: 204 });
      }

      if (url === 'https://terminal.nodove.com/session' && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }

      return new Response('Not Found', { status: 404 });
    });
    global.fetch = fetchMock as typeof fetch;

    act(() => {
      useAuthStore.getState().setTokens(accessToken, createToken(7 * 24 * 3600), {
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        emailVerified: true,
      });
    });

    const onOpen = vi.fn();
    const connection = connectTerminal({ cols: 120, rows: 40, onOpen });

    expect(connection).not.toBeNull();
    expect(document.cookie).not.toContain('terminal_token=');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const [bootstrapUrl, bootstrapInit] = fetchMock.mock.calls[0] ?? [];
    expect(bootstrapUrl).toBe('https://terminal.nodove.com/session');
    expect(bootstrapInit).toMatchObject({
      method: 'POST',
      credentials: 'include',
    });
    expect(new Headers(bootstrapInit?.headers).get('Authorization')).toBe(`Bearer ${accessToken}`);

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const webSocket = MockWebSocket.instances[0];
    const webSocketUrl = new URL(webSocket.url);
    expect(webSocketUrl.origin).toBe('wss://terminal.nodove.com');
    expect(webSocketUrl.pathname).toBe('/terminal');
    expect(webSocketUrl.searchParams.get('cols')).toBe('120');
    expect(webSocketUrl.searchParams.get('rows')).toBe('40');
    expect(webSocketUrl.searchParams.get('token')).toBeNull();

    webSocket.open();

    await waitFor(() => {
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const [clearUrl, clearInit] = fetchMock.mock.calls[1] ?? [];
    expect(clearUrl).toBe('https://terminal.nodove.com/session');
    expect(clearInit).toMatchObject({
      method: 'DELETE',
      credentials: 'include',
    });
    expect(document.cookie).not.toContain('terminal_token=');
  });

  it('does not open a websocket if the session bootstrap is rejected', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
    global.fetch = fetchMock as typeof fetch;

    act(() => {
      useAuthStore.getState().setTokens(createToken(), createToken(7 * 24 * 3600), {
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        emailVerified: true,
      });
    });

    const onError = vi.fn();
    const connection = connectTerminal({ onError });

    expect(connection).not.toBeNull();

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });

    expect(MockWebSocket.instances).toHaveLength(0);
    expect(document.cookie).not.toContain('terminal_token=');
  });

  it('does not allow runtime overrides when the terminal feature is disabled', () => {
    localStorage.setItem('aiMemo.terminalGatewayUrl', JSON.stringify('wss://override.example.com'));
    (window as Window & {
      APP_CONFIG?: {
        terminalGatewayUrl?: string | null;
        features?: { terminalEnabled?: boolean };
      };
    }).APP_CONFIG = {
      terminalGatewayUrl: 'wss://terminal.nodove.com',
      features: {
        terminalEnabled: false,
      },
    };

    expect(getTerminalGatewayUrl()).toBeNull();
    expect(connectTerminal()).toBeNull();
  });
});
