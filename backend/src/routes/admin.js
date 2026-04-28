import { Router } from 'express';
import { config } from '../config.js';
import { queryAll, isD1Configured } from '../lib/d1.js';
import requireAdmin from '../middleware/adminAuth.js'; // centralized admin auth middleware
import { buildFrontmatterMarkdown } from '../lib/markdown.js';
import {
  getDomainOutboxRepository,
  getDomainOutboxSummary,
} from '../repositories/domain-outbox.repository.js';
import {
  GITHUB_PR_STREAM,
  flushBackendDomainOutbox,
} from '../services/backend-outbox.service.js';

const router = Router();

function getIdempotencyKey(req, fallback) {
  const raw = req.headers?.['idempotency-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, 256) : fallback;
}

function buildTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 12);
}

function requireGithubConfig(res) {
  const owner = config.github.owner;
  const repo = config.github.repo;
  const token = config.github.token;
  if (!owner || !repo || !token) {
    res.status(500).json({
      ok: false,
      error: 'Server not configured for GitHub (owner/repo/token missing)',
    });
    return false;
  }
  return true;
}


router.post('/propose-new-version', requireAdmin, async (req, res, next) => {
  try {
    const { original, markdown, sourcePage } = req.body || {};
    if (!markdown || typeof markdown !== 'string') {
      return res.status(400).json({ ok: false, error: 'markdown is required' });
    }

    if (!requireGithubConfig(res)) return;

    const stamp = buildTimestamp();
    const slug = (original?.slug || 'post').toString();
    const year = (original?.year || new Date().getFullYear()).toString();
    const branch = `propose/${year}-${slug}-${stamp}`;

    let origPath = (original?.path || `/posts/${year}/${slug}.md`).toString();
    if (!origPath.startsWith('/')) origPath = `/${origPath}`;
    const proposedName = origPath.replace(/\.md$/i, `-rev-${stamp}.md`);
    const destPath = `frontend/public${proposedName}`.replace(/^\/+/, '');

    const prTitle = `Propose new version: ${year}/${slug}`;
    const prBody = [
      sourcePage ? `Source: ${sourcePage}` : '',
      original?.url ? `Original: ${original.url}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const outbox = await getDomainOutboxRepository().append({
      stream: GITHUB_PR_STREAM,
      aggregateId: `propose:${year}:${slug}`,
      eventType: 'github.pr.propose-new-version',
      payload: {
        branch,
        path: destPath,
        markdown,
        commitMessage: `propose: ${year}/${slug} (${stamp})\n\nsource: ${sourcePage || ''}`,
        prTitle,
        prBody,
      },
      idempotencyKey: getIdempotencyKey(req, `github.pr.propose:${year}:${slug}:${stamp}`),
    });

    return res.status(202).json({
      ok: true,
      data: {
        status: 'pending',
        outboxId: outbox.id,
        branch,
        path: destPath,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// Archive old comments into versioned JSON files in the repo and mark them as archived
// Query param: dryRun=1 to simulate without committing or updating database
router.post('/archive-comments', requireAdmin, async (req, res, next) => {
  try {
    // Check if D1 is configured
    if (!isD1Configured()) {
      return res.status(500).json({
        ok: false,
        error: 'Database not configured',
      });
    }

    const dryRun = String(req.query.dryRun || '').trim() === '1';
    const cutoffDays = 90;
    const cutoffDate = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoffDate.toISOString();

    // Query comments from D1 that are not archived and older than cutoff
    const comments = await queryAll(
      `SELECT id, post_id, author, content, website, parent_id, created_at
       FROM comments 
       WHERE (archived = 0 OR archived IS NULL) 
       AND created_at <= ?
       ORDER BY post_id, created_at ASC`,
      cutoffIso
    );

    if (comments.length === 0) {
      return res.json({ 
        ok: true, 
        data: { archivedPosts: [], totalComments: 0, message: 'No comments to archive' } 
      });
    }

    // Group comments by post_id
    const groups = new Map();
    for (const comment of comments) {
      const pid = String(comment.post_id);
      if (!groups.has(pid)) groups.set(pid, []);
      groups.get(pid).push(comment);
    }

    if (!dryRun && !requireGithubConfig(res)) return;

    const results = [];
    let total = 0;
    const archives = [];

    for (const [postId, items] of groups.entries()) {
      const formattedComments = items.map((c) => ({
        id: c.id,
        postId: c.post_id,
        author: c.author,
        content: c.content,
        website: c.website || null,
        parentId: c.parent_id || null,
        createdAt: c.created_at,
      }));

      total += formattedComments.length;
      const path = `frontend/src/data/comments/${postId}.json`;
      const contentStr = `${JSON.stringify({ comments: formattedComments }, null, 2)}\n`;

      if (!dryRun) {
        archives.push({
          postId,
          path,
          message: `chore(archive): comments for ${postId} (${formattedComments.length})`,
          content: contentStr,
          commentIds: items.map((c) => c.id),
        });
      }

      results.push({ postId, count: formattedComments.length, path, committed: false });
    }

    const hook = config.integrations?.vercelDeployHookUrl;
    if (!dryRun) {
      const outbox = await getDomainOutboxRepository().append({
        stream: GITHUB_PR_STREAM,
        aggregateId: `comments-archive:${cutoffIso}`,
        eventType: 'github.comments.archive',
        payload: {
          cutoffIso,
          archives,
          deployHookUrl: hook || null,
        },
        idempotencyKey: getIdempotencyKey(req, `github.comments.archive:${cutoffIso}`),
      });

      return res.status(202).json({
        ok: true,
        data: {
          status: 'pending',
          outboxId: outbox.id,
          archivedPosts: results,
          totalComments: total,
        },
      });
    }

    return res.json({ ok: true, data: { archivedPosts: results, totalComments: total } });
  } catch (err) {
    return next(err);
  }
});

// Create a new post by opening a PR that adds the markdown file under frontend/public/posts/:year/:slug.md
router.post('/create-post-pr', requireAdmin, async (req, res, next) => {
  try {
    const { title, slug: slugRaw, year: yearRaw, content, frontmatter, draft } = req.body || {};

    if (!requireGithubConfig(res)) return;

    const year = String(yearRaw || new Date().getFullYear());
    if (!/^\d{4}$/.test(year)) {
      return res.status(400).json({ ok: false, error: 'year must be YYYY' });
    }

    const baseTitle = String(title || slugRaw || 'New Post');
    const normalizedSlug = (baseTitle || 'post')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-\s_]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const filename = `${normalizedSlug || 'post'}.md`;

    const fm = {
      title: baseTitle,
      date: new Date().toISOString(),
      tags: [],
      category: 'General',
      published: draft ? false : true,
      ...(frontmatter && typeof frontmatter === 'object' ? frontmatter : {}),
    };
    const body = typeof content === 'string' ? content : '';
    const markdown = buildFrontmatterMarkdown(fm, body);

    const stamp = buildTimestamp();
    const branch = `post/${year}-${normalizedSlug}-${stamp}`;
    const destPath = `frontend/public/posts/${year}/${filename}`;
    const prTitle = `Add new post: ${baseTitle} (${year}/${normalizedSlug})`;
    const prBody = `This PR adds a new post file at ${destPath}.\n\n- Title: ${baseTitle}\n- Year: ${year}\n- Slug: ${normalizedSlug}\n- Published: ${fm.published !== false}`;

    const outbox = await getDomainOutboxRepository().append({
      stream: GITHUB_PR_STREAM,
      aggregateId: `post:${year}:${normalizedSlug}`,
      eventType: 'github.pr.create-post',
      payload: {
        branch,
        path: destPath,
        markdown,
        commitMessage: `feat(post): add ${year}/${filename}`,
        prTitle,
        prBody,
      },
      idempotencyKey: getIdempotencyKey(req, `github.pr.create-post:${year}:${normalizedSlug}:${stamp}`),
    });

    return res.status(202).json({
      ok: true,
      data: {
        status: 'pending',
        outboxId: outbox.id,
        branch,
        path: destPath,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/backend-outbox', requireAdmin, async (req, res, next) => {
  try {
    const stream = String(req.query.stream || '').trim() || undefined;
    const limit = Number.parseInt(String(req.query.limit || '25'), 10);
    const repository = getDomainOutboxRepository();
    const [stats, events] = await Promise.all([
      stream ? getDomainOutboxSummary(stream) : repository.getStats({}),
      repository.listEvents({ stream, limit: Number.isFinite(limit) ? limit : 25, includePayload: false }),
    ]);
    const summary = stream
      ? stats
      : {
          stream: null,
          pending: stats.pending,
          processing: stats.processing,
          failed: stats.failed,
          processed: stats.succeeded,
          deadLetter: stats.deadLetter,
          stuck: stats.stuck,
        };

    return res.json({ ok: true, data: { summary, events } });
  } catch (err) {
    return next(err);
  }
});

router.post('/backend-outbox/flush', requireAdmin, async (req, res, next) => {
  try {
    const result = await flushBackendDomainOutbox({
      streams: req.body?.streams || req.body?.stream,
      limit: req.body?.limit,
    });
    return res.json({ ok: true, data: result });
  } catch (err) {
    return next(err);
  }
});

export default router;
