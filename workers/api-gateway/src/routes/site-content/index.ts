import { Hono } from 'hono';
import type { HonoEnv } from '../../types';
import { createD1SiteContentRepository } from '../../adapters/site-content/d1SiteContentRepository';
import { parseSiteContentBlockKey } from '../../domain/site-content/types';
import { badRequest, error, success } from '../../lib/response';
import { requireAdmin } from '../../middleware/auth';
import { getSiteContentBlock } from '../../use-cases/site-content/getSiteContentBlock';
import {
  saveSiteContentBlock,
  SiteContentValidationError,
} from '../../use-cases/site-content/saveSiteContentBlock';

const siteContent = new Hono<HonoEnv>();

siteContent.get('/admin/:key', requireAdmin, async (c) => {
  const rawKey = c.req.param('key');
  const key = rawKey ? parseSiteContentBlockKey(rawKey) : null;
  if (!key) return badRequest(c, 'Invalid site content block key');

  try {
    const repository = createD1SiteContentRepository(c.env.DB);
    const block = await getSiteContentBlock(repository, key);
    return success(c, { block });
  } catch (err) {
    console.error('site-content admin read failed', {
      key,
      err: err instanceof Error ? err.message : String(err),
    });
    return error(c, 'Failed to read site content block', 500);
  }
});

siteContent.put('/admin/:key', requireAdmin, async (c) => {
  const rawKey = c.req.param('key');
  const key = rawKey ? parseSiteContentBlockKey(rawKey) : null;
  if (!key) return badRequest(c, 'Invalid site content block key');

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return badRequest(c, 'Request body must be a JSON object');
  }

  const user = c.get('user');
  const changedBy = user.email || user.username || user.sub || 'admin';

  try {
    const repository = createD1SiteContentRepository(c.env.DB);
    const block = await saveSiteContentBlock(repository, key, {
      ...(body as {
        markdown: string;
        ctaLabel?: string | null;
        ctaHref?: string | null;
        enabled?: boolean;
      }),
      changedBy,
    });
    console.info('site-content block updated', { key, changedBy });
    return success(c, { block });
  } catch (err) {
    if (err instanceof SiteContentValidationError) {
      return badRequest(c, err.message);
    }

    console.error('site-content admin save failed', {
      key,
      err: err instanceof Error ? err.message : String(err),
    });
    return error(c, 'Failed to save site content block', 500);
  }
});

siteContent.get('/:key', async (c) => {
  const rawKey = c.req.param('key');
  const key = rawKey ? parseSiteContentBlockKey(rawKey) : null;
  if (!key) return badRequest(c, 'Invalid site content block key');

  try {
    const repository = createD1SiteContentRepository(c.env.DB);
    const block = await getSiteContentBlock(repository, key);
    return success(c, { block });
  } catch (err) {
    console.error('site-content public read failed', {
      key,
      err: err instanceof Error ? err.message : String(err),
    });
    return error(c, 'Failed to read site content block', 500);
  }
});

export default siteContent;
