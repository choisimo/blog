import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { signJwt } from '../src/lib/jwt';
import { hashContent, type SourcePost, type SupportedTranslationLang } from '../src/lib/translation-service';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv
    extends Pick<Env, 'DB' | 'R2' | 'KV' | 'JWT_SECRET' | 'ENV' | 'PUBLIC_SITE_URL' | 'BACKEND_ORIGIN'> {}
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

type CachedSeedOverrides = {
  title?: string;
  description?: string;
  content?: string;
  contentHash?: string;
  isAiGenerated?: number;
  createdAt?: string;
  updatedAt?: string;
};

const publishedPosts = new Map<string, SourcePost>();
const markdownPaths = new Map<string, SourcePost>();

let originalFetch: typeof fetch;
let aiGenerateHandler: ((prompt: string) => Promise<string>) | null;

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function buildSourcePost(overrides: Partial<SourcePost> = {}): SourcePost {
  const slug = overrides.slug ?? `post-${crypto.randomUUID()}`;

  return {
    year: overrides.year ?? '2024',
    slug,
    title: overrides.title ?? 'Source title',
    description: overrides.description ?? 'Source description',
    content: overrides.content ?? '# Source content',
    sourceLang: overrides.sourceLang ?? 'ko',
  };
}

function buildMarkdown(sourcePost: SourcePost): string {
  return `---
title: "${sourcePost.title}"
description: "${sourcePost.description}"
defaultLanguage: "${sourcePost.sourceLang}"
---

${sourcePost.content}`;
}

function registerPublishedPost(sourcePost: SourcePost): void {
  const key = `${sourcePost.year}:${sourcePost.slug}`;
  const path = `/posts/${sourcePost.year}/${sourcePost.slug}.md`;

  publishedPosts.set(key, sourcePost);
  markdownPaths.set(path, sourcePost);
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return new Response(JSON.stringify(body), { ...init, headers });
}

function textResponse(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/markdown; charset=utf-8');
  }

  return new Response(body, { ...init, headers });
}

function installFetchInterception(): void {
  originalFetch = globalThis.fetch;

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url === `${env.PUBLIC_SITE_URL}/posts-manifest.json`) {
      return jsonResponse({
        items: Array.from(publishedPosts.values()).map((sourcePost) => ({
          year: sourcePost.year,
          slug: sourcePost.slug,
          title: sourcePost.title,
          description: sourcePost.description,
          published: true,
          language: sourcePost.sourceLang,
          defaultLanguage: sourcePost.sourceLang,
          path: `/posts/${sourcePost.year}/${sourcePost.slug}.md`,
        })),
      });
    }

    if (url.startsWith(String(env.PUBLIC_SITE_URL))) {
      const pathname = new URL(url).pathname;
      const sourcePost = markdownPaths.get(pathname);
      if (!sourcePost) {
        return new Response('Not Found', { status: 404 });
      }

      return textResponse(buildMarkdown(sourcePost));
    }

    if (url === `${env.BACKEND_ORIGIN}/api/v1/ai/generate`) {
      if (!aiGenerateHandler) {
        return jsonResponse({ ok: false, error: 'Unhandled AI generate request' }, { status: 500 });
      }

      const bodyText =
        typeof input === 'object' && input instanceof Request && input.method !== 'GET'
          ? await input.clone().text()
          : typeof init?.body === 'string'
            ? init.body
            : '';
      const payload = JSON.parse(bodyText) as { prompt?: string };
      const text = await aiGenerateHandler(payload.prompt ?? '');
      return jsonResponse({ ok: true, data: { text } });
    }

    return originalFetch(input, init);
  });
}

async function seedCachedTranslation(
  sourcePost: SourcePost,
  targetLang: SupportedTranslationLang,
  overrides: CachedSeedOverrides = {}
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO post_translations_cache (
      post_slug,
      year,
      source_lang,
      target_lang,
      title,
      description,
      content,
      content_hash,
      is_ai_generated,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      sourcePost.slug,
      sourcePost.year,
      sourcePost.sourceLang,
      targetLang,
      overrides.title ?? 'Translated title',
      overrides.description ?? 'Translated description',
      overrides.content ?? '# Translated content',
      overrides.contentHash ?? hashContent(sourcePost.content),
      overrides.isAiGenerated ?? 1,
      overrides.createdAt ?? '2026-03-27T10:00:00.000Z',
      overrides.updatedAt ?? '2026-03-27T10:05:00.000Z'
    )
    .run();
}

async function createUserToken(): Promise<string> {
  return signJwt(
    {
      sub: 'user-1',
      role: 'user',
      username: 'user',
      type: 'access',
    },
    env
  );
}

async function createAdminToken(): Promise<string> {
  return signJwt(
    {
      sub: 'admin-1',
      role: 'admin',
      username: 'admin',
      emailVerified: true,
      type: 'access',
    },
    env
  );
}

async function ensureDomainOutboxCompatColumns(): Promise<void> {
  const columns = await env.DB.prepare('PRAGMA table_info(domain_outbox)').all<{
    name: string;
  }>();
  const knownColumns = new Set((columns.results || []).map((column) => column.name));

  if (!knownColumns.has('last_attempt_at')) {
    await env.DB.prepare('ALTER TABLE domain_outbox ADD COLUMN last_attempt_at TEXT').run();
  }

  if (!knownColumns.has('processed_at')) {
    await env.DB.prepare('ALTER TABLE domain_outbox ADD COLUMN processed_at TEXT').run();
  }

  if (!knownColumns.has('last_error')) {
    await env.DB.prepare('ALTER TABLE domain_outbox ADD COLUMN last_error TEXT').run();
  }
}

beforeEach(async () => {
  vi.restoreAllMocks();
  publishedPosts.clear();
  markdownPaths.clear();
  aiGenerateHandler = null;

  env.JWT_SECRET = 'translation-route-test-secret';
  env.PUBLIC_SITE_URL = 'https://public.example';
  env.BACKEND_ORIGIN = 'https://backend.example';

  await ensureDomainOutboxCompatColumns();
  await env.DB.prepare('DELETE FROM post_translations_cache').run();
  await env.DB.prepare('DELETE FROM domain_outbox').run();

  installFetchInterception();
});

afterEach(() => {
  vi.restoreAllMocks();
  publishedPosts.clear();
  markdownPaths.clear();
  aiGenerateHandler = null;
});

describe('translation routes characterization', () => {
  it('returns cached public translations from the real worker app', async () => {
    const sourcePost = buildSourcePost();
    registerPublishedPost(sourcePost);
    await seedCachedTranslation(sourcePost, 'en');

    const response = await SELF.fetch(
      `https://example.com/api/v1/public/posts/${sourcePost.year}/${sourcePost.slug}/translations/en/cache`
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        title: 'Translated title',
        description: 'Translated description',
        content: '# Translated content',
        cached: true,
        isAiGenerated: true,
        createdAt: '2026-03-27T10:00:00.000Z',
        updatedAt: '2026-03-27T10:05:00.000Z',
      },
    });
  });

  it('returns stale cached translations while warming', async () => {
    const sourcePost = buildSourcePost();
    registerPublishedPost(sourcePost);
    await seedCachedTranslation(sourcePost, 'en', {
      title: 'Stale title',
      description: 'Stale description',
      content: '# Stale content',
      contentHash: 'stale-content-hash',
    });

    const response = await SELF.fetch(
      `https://example.com/api/v1/public/posts/${sourcePost.year}/${sourcePost.slug}/translations/en`
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        title: 'Stale title',
        description: 'Stale description',
        content: '# Stale content',
        cached: true,
        isAiGenerated: true,
        createdAt: '2026-03-27T10:00:00.000Z',
        updatedAt: '2026-03-27T10:05:00.000Z',
        stale: true,
        warming: true,
      },
    });
  });

  it('returns 202 and Retry-After when public translation generation is queued', async () => {
    const sourcePost = buildSourcePost();
    registerPublishedPost(sourcePost);

    const response = await SELF.fetch(
      `https://example.com/api/v1/public/posts/${sourcePost.year}/${sourcePost.slug}/translations/en`
    );

    expect(response.status).toBe(202);
    expect(response.headers.get('Retry-After')).toBe('15');
    await expect(response.json()).resolves.toEqual({ ok: true, data: null });
  });

  it('returns NOT_AVAILABLE when the published source post does not exist', async () => {
    const response = await SELF.fetch(
      'https://example.com/api/v1/public/posts/2099/missing-post/translations/en'
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        message: 'Published post not found',
        code: 'NOT_AVAILABLE',
      },
    });
  });

  it('deletes cached translations through the internal admin route', async () => {
    const sourcePost = buildSourcePost();
    const adminToken = await createAdminToken();
    await seedCachedTranslation(sourcePost, 'en', {
      title: 'Cached title',
      description: 'Cached description',
      content: '# Cached content',
      contentHash: 'delete-hash',
    });

    const response = await SELF.fetch(
      `https://example.com/api/v1/internal/posts/${sourcePost.year}/${sourcePost.slug}/translations/en`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    const remaining = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM post_translations_cache WHERE post_slug = ? AND year = ? AND target_lang = ?'
    )
      .bind(sourcePost.slug, sourcePost.year, 'en')
      .first<{ count: number }>();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, data: { deleted: true } });
    expect(Number(remaining?.count ?? 0)).toBe(0);
  });

  it('serves the legacy public alias with deprecation headers', async () => {
    const sourcePost = buildSourcePost();
    registerPublishedPost(sourcePost);
    await seedCachedTranslation(sourcePost, 'en', {
      title: 'Legacy title',
      description: 'Legacy description',
      content: '# Legacy content',
    });

    const response = await SELF.fetch(
      `https://example.com/api/v1/translate/${sourcePost.year}/${sourcePost.slug}/en`
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Deprecation')).toBe('true');
    expect(response.headers.get('Sunset')).toBe('Tue, 30 Jun 2026 00:00:00 GMT');
    expect(response.headers.get('Link')).toBe(
      `</api/v1/public/posts/${sourcePost.year}/${sourcePost.slug}/translations/en/cache>; rel="successor-version"`
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        title: 'Legacy title',
        description: 'Legacy description',
        content: '# Legacy content',
        cached: true,
        isAiGenerated: true,
        createdAt: '2026-03-27T10:00:00.000Z',
        updatedAt: '2026-03-27T10:05:00.000Z',
      },
    });
  });

  it('accepts async generation requests and exposes job headers', async () => {
    const sourcePost = buildSourcePost();
    const userToken = await createUserToken();
    const deferred = createDeferred<string>();
    let callCount = 0;

    registerPublishedPost(sourcePost);
    aiGenerateHandler = async () => {
      callCount += 1;
      if (callCount === 1) {
        return deferred.promise;
      }

      if (callCount === 2) {
        return 'Finished description';
      }

      return '# Finished content';
    };

    const response = await SELF.fetch(
      `https://example.com/api/v1/internal/posts/${sourcePost.year}/${sourcePost.slug}/translations/en/generate?async=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forceRefresh: true }),
      }
    );

    const payload = (await response.json()) as {
      ok: boolean;
      data: null;
      job: {
        id: string;
        status: string;
        statusUrl: string;
        cacheUrl: string;
        generateUrl: string;
      };
    };

    expect(response.status).toBe(202);
    expect(response.headers.get('Retry-After')).toBe('3');
    expect(response.headers.get('X-Translation-Job-Id')).toBe(payload.job.id);
    expect(response.headers.get('Location')).toBe(payload.job.statusUrl);
    expect(payload.ok).toBe(true);
    expect(payload.data).toBeNull();
    expect(payload.job.status).toBe('running');

    deferred.resolve('Finished title');
    await deferred.promise;
  });

  it('reports running async jobs with Retry-After on the internal status route', async () => {
    const sourcePost = buildSourcePost();
    const userToken = await createUserToken();
    const deferred = createDeferred<string>();
    let callCount = 0;

    registerPublishedPost(sourcePost);
    aiGenerateHandler = async () => {
      callCount += 1;
      if (callCount === 1) {
        return deferred.promise;
      }

      if (callCount === 2) {
        return 'Finished description';
      }

      return '# Finished content';
    };

    const generateResponse = await SELF.fetch(
      `https://example.com/api/v1/internal/posts/${sourcePost.year}/${sourcePost.slug}/translations/en/generate?async=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forceRefresh: true }),
      }
    );
    const generatePayload = (await generateResponse.json()) as {
      job: { id: string };
    };

    const statusResponse = await SELF.fetch(
      `https://example.com/api/v1/internal/posts/${sourcePost.year}/${sourcePost.slug}/translations/en/generate/status?jobId=${generatePayload.job.id}`,
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      }
    );

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.headers.get('Retry-After')).toBe('3');
    expect(statusResponse.headers.get('X-Translation-Job-Id')).toBe(generatePayload.job.id);
    await expect(statusResponse.json()).resolves.toMatchObject({
      ok: true,
      data: {
        job: {
          id: generatePayload.job.id,
          status: 'running',
        },
      },
    });

    deferred.resolve('Finished title');
    await deferred.promise;
  });

  it('returns NOT_FOUND for unknown translation jobs', async () => {
    const sourcePost = buildSourcePost();
    const userToken = await createUserToken();

    const response = await SELF.fetch(
      `https://example.com/api/v1/internal/posts/${sourcePost.year}/${sourcePost.slug}/translations/en/generate/status?jobId=missing-job`,
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        message: 'Translation job not found',
        code: 'NOT_FOUND',
      },
    });
  });
});
