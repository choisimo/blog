import { Router } from 'express';
import { config } from '../config.js';
import { createLogger } from '../lib/logger.js';
import { requireUserAuth } from '../middleware/userAuth.js';
import requireAdmin from '../middleware/adminAuth.js';

const router = Router();
const logger = createLogger('translate');
const TRANSLATE_PROXY_TIMEOUT_MS = Math.max(
  5_000,
  Number.parseInt(process.env.TRANSLATE_PROXY_TIMEOUT_MS || '20000', 10),
);

function buildWorkerTranslateHeaders(req) {
  const headers = {
    Accept: req.get('accept') || 'application/json',
  };

  const contentType = req.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  const authorization = req.get('authorization');
  if (authorization) {
    headers.Authorization = authorization;
  }

  const requestId = req.get('x-request-id');
  if (requestId) {
    headers['X-Request-Id'] = requestId;
  }

  if (config.backendKey) {
    headers['X-Backend-Key'] = config.backendKey;
  }

  return headers;
}

async function proxyTranslateToWorker(req, res, workerPath) {
  const workerApiUrl = config.services?.workerApiUrl;
  if (!workerApiUrl) {
    return res.status(503).json({
      ok: false,
      error: 'WORKER_API_URL is not configured',
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TRANSLATE_PROXY_TIMEOUT_MS);

  try {
    const upstreamUrl = workerApiUrl.replace(/\/$/, '') + workerPath;
    const rawBody =
      req.body == null
        ? undefined
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body);

    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: buildWorkerTranslateHeaders(req),
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : rawBody,
      signal: controller.signal,
    });

    const responseBody = await upstreamResponse.text();
    const hopByHopHeaders = new Set([
      'connection',
      'content-length',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailer',
      'transfer-encoding',
      'upgrade',
    ]);

    upstreamResponse.headers.forEach((value, key) => {
      if (!hopByHopHeaders.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    if (!res.getHeader('content-type')) {
      res.type('application/json');
    }

    return res.status(upstreamResponse.status).send(responseBody);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      logger.warn({}, 'Translate proxy timed out', {
        workerPath,
        timeoutMs: TRANSLATE_PROXY_TIMEOUT_MS,
      });
      return res.status(504).json({
        ok: false,
        error: 'Translate upstream timed out',
        code: 'AI_TIMEOUT',
      });
    }

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

router.get('/public/posts/:year/:slug/translations/:targetLang', async (req, res, next) => {
  try {
    const { year, slug, targetLang } = req.params;
    return await proxyTranslateToWorker(
      req,
      res,
      `/api/v1/public/posts/${encodeURIComponent(year)}/${encodeURIComponent(slug)}/translations/${encodeURIComponent(targetLang)}`,
    );
  } catch (err) {
    return next(err);
  }
});

router.get('/public/posts/:year/:slug/translations/:targetLang/cache', async (req, res, next) => {
  try {
    const { year, slug, targetLang } = req.params;
    return await proxyTranslateToWorker(
      req,
      res,
      `/api/v1/public/posts/${encodeURIComponent(year)}/${encodeURIComponent(slug)}/translations/${encodeURIComponent(targetLang)}/cache`,
    );
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/internal/posts/:year/:slug/translations/:targetLang/generate',
  requireUserAuth,
  async (req, res, next) => {
    try {
      const { year, slug, targetLang } = req.params;
      return await proxyTranslateToWorker(
        req,
        res,
        `/api/v1/internal/posts/${encodeURIComponent(year)}/${encodeURIComponent(slug)}/translations/${encodeURIComponent(targetLang)}/generate`,
      );
    } catch (err) {
      return next(err);
    }
  },
);

router.get(
  '/internal/posts/:year/:slug/translations/:targetLang/generate/status',
  requireUserAuth,
  async (req, res, next) => {
    try {
      const { year, slug, targetLang } = req.params;
      const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      return await proxyTranslateToWorker(
        req,
        res,
        `/api/v1/internal/posts/${encodeURIComponent(year)}/${encodeURIComponent(slug)}/translations/${encodeURIComponent(targetLang)}/generate/status${query}`,
      );
    } catch (err) {
      return next(err);
    }
  },
);

router.get(
  '/internal/posts/:year/:slug/translations/:targetLang/status',
  requireUserAuth,
  async (req, res, next) => {
    try {
      const { year, slug, targetLang } = req.params;
      const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      return await proxyTranslateToWorker(
        req,
        res,
        `/api/v1/internal/posts/${encodeURIComponent(year)}/${encodeURIComponent(slug)}/translations/${encodeURIComponent(targetLang)}/status${query}`,
      );
    } catch (err) {
      return next(err);
    }
  },
);

router.delete(
  '/internal/posts/:year/:slug/translations/:targetLang',
  requireAdmin,
  async (req, res, next) => {
    try {
      const { year, slug, targetLang } = req.params;
      return await proxyTranslateToWorker(
        req,
        res,
        `/api/v1/internal/posts/${encodeURIComponent(year)}/${encodeURIComponent(slug)}/translations/${encodeURIComponent(targetLang)}`,
      );
    } catch (err) {
      return next(err);
    }
  },
);

router.delete(
  '/internal/posts/:year/:slug/translations/:targetLang/cache',
  requireAdmin,
  async (req, res, next) => {
    try {
      const { year, slug, targetLang } = req.params;
      return await proxyTranslateToWorker(
        req,
        res,
        `/api/v1/internal/posts/${encodeURIComponent(year)}/${encodeURIComponent(slug)}/translations/${encodeURIComponent(targetLang)}/cache`,
      );
    } catch (err) {
      return next(err);
    }
  },
);

router.post('/translate', requireUserAuth, async (req, res, next) => {
  try {
    return await proxyTranslateToWorker(req, res, '/api/v1/translate');
  } catch (err) {
    return next(err);
  }
});

router.get('/translate/:year/:slug/:targetLang', async (req, res, next) => {
  try {
    const { year, slug, targetLang } = req.params;
    return await proxyTranslateToWorker(
      req,
      res,
      `/api/v1/translate/${encodeURIComponent(year)}/${encodeURIComponent(slug)}/${encodeURIComponent(targetLang)}`,
    );
  } catch (err) {
    return next(err);
  }
});

router.get('/translate/:year/:slug/:targetLang/status', requireUserAuth, async (req, res, next) => {
  try {
    const { year, slug, targetLang } = req.params;
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    return await proxyTranslateToWorker(
      req,
      res,
      `/api/v1/translate/${encodeURIComponent(year)}/${encodeURIComponent(slug)}/${encodeURIComponent(targetLang)}/status${query}`,
    );
  } catch (err) {
    return next(err);
  }
});

router.delete('/translate/:year/:slug/:targetLang', requireAdmin, async (req, res, next) => {
  try {
    const { year, slug, targetLang } = req.params;
    return await proxyTranslateToWorker(
      req,
      res,
      `/api/v1/translate/${encodeURIComponent(year)}/${encodeURIComponent(slug)}/${encodeURIComponent(targetLang)}`,
    );
  } catch (err) {
    return next(err);
  }
});

export default router;
