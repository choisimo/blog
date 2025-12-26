import { Router } from 'express';
import { Octokit } from '@octokit/rest';
import { config } from '../config.js';
import { queryAll, execute, isD1Configured } from '../lib/d1.js';
import requireAdmin from '../middleware/adminAuth.js'; // centralized admin auth middleware
import { buildFrontmatterMarkdown } from '../lib/markdown.js';

const router = Router();


router.post('/propose-new-version', requireAdmin, async (req, res, next) => {
  try {
    const { original, markdown, sourcePage } = req.body || {};
    if (!markdown || typeof markdown !== 'string') {
      return res.status(400).json({ ok: false, error: 'markdown is required' });
    }

    const owner = config.github.owner;
    const repo = config.github.repo;
    const token = config.github.token;
    if (!owner || !repo || !token) {
      return res.status(500).json({
        ok: false,
        error: 'Server not configured for GitHub (owner/repo/token missing)',
      });
    }

    const octokit = new Octokit({ auth: token });

    // get repo default branch
    const repoInfo = await octokit.rest.repos.get({ owner, repo });
    const baseBranch = repoInfo.data.default_branch || 'main';

    // base ref
    const baseRef = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    });
    const baseSha = baseRef.data.object.sha;

    // branch name
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 12);
    const slug = (original?.slug || 'post').toString();
    const year = (original?.year || new Date().getFullYear()).toString();
    const branch = `propose/${year}-${slug}-${stamp}`;

    // create branch
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    });

    // destination path
    let origPath = (original?.path || `/posts/${year}/${slug}.md`).toString();
    if (!origPath.startsWith('/')) origPath = `/${origPath}`;
    // Propose into a new file to avoid overwriting
    const proposedName = origPath.replace(/\.md$/i, `-rev-${stamp}.md`);
    const destPath = `frontend/public${proposedName}`.replace(/^\/+/, '');

    // commit file content
    const contentBase64 = Buffer.from(markdown, 'utf-8').toString('base64');
    const message = `propose: ${year}/${slug} (${stamp})\n\nsource: ${sourcePage || ''}`;

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: destPath,
      message,
      content: contentBase64,
      branch,
      committer:
        config.github.gitUserName && config.github.gitUserEmail
          ? {
              name: config.github.gitUserName,
              email: config.github.gitUserEmail,
            }
          : undefined,
      author:
        config.github.gitUserName && config.github.gitUserEmail
          ? {
              name: config.github.gitUserName,
              email: config.github.gitUserEmail,
            }
          : undefined,
    });

    // create PR
    const prTitle = `Propose new version: ${year}/${slug}`;
    const prBody = [
      sourcePage ? `Source: ${sourcePage}` : '',
      original?.url ? `Original: ${original.url}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const pr = await octokit.rest.pulls.create({
      owner,
      repo,
      title: prTitle,
      head: branch,
      base: baseBranch,
      body: prBody,
    });

    return res.json({ ok: true, data: { prUrl: pr.data.html_url } });
  } catch (err) {
    return next(err);
  }
});

// Archive old comments into versioned JSON files in the repo and mark them as archived
// Query param: dryRun=1 to simulate without committing or updating D1
// Now uses Cloudflare D1 instead of Firebase Firestore
router.post('/archive-comments', requireAdmin, async (req, res, next) => {
  try {
    // Check if D1 is configured
    if (!isD1Configured()) {
      return res.status(500).json({
        ok: false,
        error: 'D1 database not configured. Set CF_ACCOUNT_ID, CF_API_TOKEN, D1_DATABASE_ID',
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

    const owner = config.github.owner;
    const repo = config.github.repo;
    const token = config.github.token;
    if (!owner || !repo || !token) {
      return res.status(500).json({
        ok: false,
        error: 'Server not configured for GitHub (owner/repo/token missing)',
      });
    }

    const octokit = new Octokit({ auth: token });
    // Ensure we use default branch
    const repoInfo = await octokit.rest.repos.get({ owner, repo });
    const baseBranch = repoInfo.data.default_branch || 'main';

    const results = [];
    let total = 0;

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
        // get existing sha if any
        let sha;
        try {
          const existing = await octokit.rest.repos.getContent({ owner, repo, path, ref: baseBranch });
          if (!Array.isArray(existing.data)) sha = existing.data.sha;
        } catch (_) {
          // not found OK
        }

        await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          message: `chore(archive): comments for ${postId} (${formattedComments.length})`,
          content: Buffer.from(contentStr, 'utf8').toString('base64'),
          branch: baseBranch,
          committer:
            config.github.gitUserName && config.github.gitUserEmail
              ? { name: config.github.gitUserName, email: config.github.gitUserEmail }
              : undefined,
          author:
            config.github.gitUserName && config.github.gitUserEmail
              ? { name: config.github.gitUserName, email: config.github.gitUserEmail }
              : undefined,
          sha,
        });

        // Mark archived in D1
        const ids = items.map(c => c.id);
        const placeholders = ids.map(() => '?').join(',');
        await execute(
          `UPDATE comments SET archived = 1, updated_at = datetime('now') WHERE id IN (${placeholders})`,
          ...ids
        );
      }

      results.push({ postId, count: formattedComments.length, path, committed: !dryRun });
    }

    // Optional deploy hook (compat)
    const hook = config.integrations?.vercelDeployHookUrl;
    if (hook && !dryRun) {
      try {
        await fetch(hook, { method: 'POST' });
      } catch (_) {}
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

    const owner = config.github.owner;
    const repo = config.github.repo;
    const token = config.github.token;
    if (!owner || !repo || !token) {
      return res.status(500).json({ ok: false, error: 'Server not configured for GitHub (owner/repo/token missing)' });
    }

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

    const octokit = new Octokit({ auth: token });

    // Get default branch
    const repoInfo = await octokit.rest.repos.get({ owner, repo });
    const baseBranch = repoInfo.data.default_branch || 'main';

    // Base ref SHA
    const baseRef = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
    const baseSha = baseRef.data.object.sha;

    // Branch name
    const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 12);
    const branch = `post/${year}-${normalizedSlug}-${stamp}`;

    await octokit.rest.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: baseSha });

    // Destination path in repo
    const destPath = `frontend/public/posts/${year}/${filename}`;

    // Commit file
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: destPath,
      message: `feat(post): add ${year}/${filename}`,
      content: Buffer.from(markdown, 'utf8').toString('base64'),
      branch,
      committer:
        config.github.gitUserName && config.github.gitUserEmail
          ? { name: config.github.gitUserName, email: config.github.gitUserEmail }
          : undefined,
      author:
        config.github.gitUserName && config.github.gitUserEmail
          ? { name: config.github.gitUserName, email: config.github.gitUserEmail }
          : undefined,
    });

    // Optionally run manifest generation file updates inside PR by touching a file
    // (CI will generate manifests automatically on PR)

    // Create PR
    const prTitle = `Add new post: ${baseTitle} (${year}/${normalizedSlug})`;
    const prBody = `This PR adds a new post file at ${destPath}.\n\n- Title: ${baseTitle}\n- Year: ${year}\n- Slug: ${normalizedSlug}\n- Published: ${fm.published !== false}`;

    const pr = await octokit.rest.pulls.create({
      owner,
      repo,
      title: prTitle,
      head: branch,
      base: baseBranch,
      body: prBody,
    });

    return res.status(201).json({ ok: true, data: { prUrl: pr.data.html_url, branch, path: destPath } });
  } catch (err) {
    return next(err);
  }
});

export default router;
