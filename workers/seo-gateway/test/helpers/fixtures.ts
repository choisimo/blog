import type { Env, ManifestItem } from '../../src/types';
export const env: Env = {
  GITHUB_PAGES_ORIGIN: 'https://pages.example/blog',
  RAW_CONTENT_ORIGIN: 'https://raw.example/repo/public',
  API_BASE_URL: 'https://api.example', SITE_BASE_URL: 'https://site.example', SITE_NAME: 'Site',
};
export const post: ManifestItem = {
  year: '2026', slug: 'sample-post', title: 'Sample post', description: 'Description',
  published: true, author: 'Author', category: 'Engineering', tags: ['A', 'B', 'A'], date: '2026-09-10',
};
export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}
export function inputUrl(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}
