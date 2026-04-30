import '@testing-library/jest-dom';

// Provide a stable in-memory localStorage/sessionStorage for tests
(function ensureStorage() {
  const makeStorage = () => {
    const store = new Map<string, string>();
    return {
      get length() {
        return store.size;
      },
      clear() {
        store.clear();
      },
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key: string) {
        store.delete(key);
      },
      setItem(key: string, value: string) {
        store.set(String(key), String(value));
      },
    } as Storage;
  };
  try {
    // If jsdom provided storages are missing or broken, replace them
    if (!('localStorage' in window) || typeof window.localStorage?.getItem !== 'function') {
      Object.defineProperty(window, 'localStorage', {
        value: makeStorage(),
        configurable: true,
        writable: true,
      });
    }
    if (!('sessionStorage' in window) || typeof window.sessionStorage?.getItem !== 'function') {
      Object.defineProperty(window, 'sessionStorage', {
        value: makeStorage(),
        configurable: true,
        writable: true,
      });
    }
  } catch {
    // As a fallback, force-define
    Object.defineProperty(window, 'localStorage', {
      value: makeStorage(),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'sessionStorage', {
      value: makeStorage(),
      configurable: true,
      writable: true,
    });
  }
})();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock IntersectionObserver
global.IntersectionObserver = class {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as unknown as typeof IntersectionObserver;

// Mock ResizeObserver
global.ResizeObserver = class {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;

// Mock window.scrollTo to avoid jsdom not-implemented errors
window.scrollTo = (() => { void 0; }) as any;

// Stub fetch for posts-manifest.json in tests that render the app shell
const originalFetch = global.fetch;
// Provide a minimal, valid manifest shape used by tests
const stubManifest = {
  total: 1,
  generatedAt: new Date().toISOString(),
  years: ['2025'],
  items: [
    {
      path: '/posts/2025/foo.md',
      year: '2025',
      slug: 'foo',
      title: 'Foo',
      description: 'Test post',
      snippet: 'Test post',
      date: '2025-01-01',
      tags: [],
      category: 'General',
      author: 'Admin',
      readingTime: '1 min read',
      published: true,
      coverImage: undefined,
      url: '/blog/2025/foo',
    },
  ],
};

global.fetch = (input: any, init?: any): Promise<Response> => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
  if (url.endsWith('/posts-manifest.json')) {
    return Promise.resolve(
      new Response(JSON.stringify(stubManifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }
  if (
    url.startsWith('http://localhost:5080/') ||
    url.startsWith('http://127.0.0.1:5080/') ||
    url.startsWith('https://api.nodove.com/')
  ) {
    const parsed = new URL(url);

    if (parsed.pathname === '/api/v1/public/config') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              apiBaseUrl: 'https://api.nodove.com',
              features: {
                aiEnabled: true,
                ragEnabled: true,
                terminalEnabled: false,
                aiInline: true,
                codeExecutionEnabled: false,
                commentsEnabled: true,
              },
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );
    }

    if (parsed.pathname === '/api/v1/notifications/unread') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [],
              unreadCount: 0,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );
    }

    if (
      parsed.pathname === '/api/v1/notifications/history' ||
      /^\/api\/v1\/notifications\/[^/]+\/read$/.test(parsed.pathname)
    ) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [],
              id: 'test-notification',
              readAt: new Date().toISOString(),
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );
    }

    return Promise.resolve(
      new Response(JSON.stringify({ ok: true, data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }
  return originalFetch(input as any, init);
};
