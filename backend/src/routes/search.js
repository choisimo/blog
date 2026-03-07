import { Router } from 'express';
import { createWebSearchTool } from '../lib/agent/tools/web-search.js';

const router = Router();

router.get('/health', async (req, res) => {
  // DuckDuckGo engine works without API keys
  const configured = true;
  res.json({ ok: true, data: { status: configured ? 'configured' : 'unconfigured' } });
});

router.post('/web', async (req, res, next) => {
  try {
    const { query, maxResults = 5, searchDepth = 'basic' } = req.body || {};
    const q = String(query || '').trim();
    if (!q) return res.status(400).json({ ok: false, error: 'query is required' });

    const tool = createWebSearchTool();

    const started = Date.now();

    // Map searchDepth to engine preference
    const engine = searchDepth === 'advanced' ? (process.env.WEB_SEARCH_ENGINE || 'serper') : 'duckduckgo';

    const result = await tool.execute({
      action: 'search',
      query: q,
      engine,
      limit: Math.max(1, Math.min(10, Number(maxResults) || 5)),
    });

    const responseTime = Date.now() - started;

    if (!result?.success) {
      return res.status(502).json({ ok: false, error: result?.error || 'web search failed' });
    }

    const results = Array.isArray(result.results) ? result.results : [];

    // Normalize to frontend type
    const normalized = results.map((r, idx) => ({
      title: String(r.title || ''),
      url: String(r.url || ''),
      snippet: String(r.snippet || ''),
      score: Math.max(0, 1 - idx * 0.05),
      publishedDate: r.publishedDate || undefined,
    }));

    return res.json({
      ok: true,
      data: {
        query: q,
        results: normalized,
        responseTime,
      },
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
