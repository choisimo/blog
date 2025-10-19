import '@testing-library/jest-dom';

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
// eslint-disable-next-line @typescript-eslint/no-empty-function
window.scrollTo = (() => {}) as any;

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
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  if (url.endsWith('/posts-manifest.json')) {
    return Promise.resolve(new Response(JSON.stringify(stubManifest), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  return originalFetch(input as any, init);
};
