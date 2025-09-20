import { Router } from 'express';
import { Octokit } from '@octokit/rest';
import { config } from '../config.js';
import { getDb, Timestamp } from '../lib/firebase.js';
import requireAdmin from '../middleware/adminAuth.js'; // centralized admin auth middleware

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
// Query param: dryRun=1 to simulate without committing or updating Firestore
router.post('/archive-comments', requireAdmin, async (req, res, next) => {
  try {
    const dryRun = String(req.query.dryRun || '').trim() === '1';
    const cutoffDays = 90;
    const cutoffDate = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000);
    const cutoffTs = Timestamp.fromDate(cutoffDate);

    const db = getDb();
    const snap = await db
      .collection('comments')
      .where('archived', '==', false)
      .where('createdAt', '<=', cutoffTs)
      .get();

    if (snap.empty) {
      return res.json({ ok: true, data: { archivedPosts: [], totalComments: 0, message: 'No comments to archive' } });
    }

    const groups = new Map();
    snap.forEach(doc => {
      const data = doc.data();
      const pid = String(data.postId);
      if (!groups.has(pid)) groups.set(pid, []);
      groups.get(pid).push({ id: doc.id, data });
    });

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
      const comments = items
        .map(({ id, data }) => ({
          id,
          postId: data.postId,
          author: data.author,
          content: data.content,
          website: data.website || null,
          parentId: data.parentId || null,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
        }))
        .sort((a, b) => {
          const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
          const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
          return ta - tb;
        });

      total += comments.length;
      const path = `frontend/src/data/comments/${postId}.json`;
      const contentStr = `${JSON.stringify({ comments }, null, 2)}\n`;

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
          message: `chore(archive): comments for ${postId} (${comments.length})`,
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

        // Mark archived in Firestore
        const batch = db.batch();
        items.forEach(({ id }) => {
          const ref = db.collection('comments').doc(id);
          batch.update(ref, { archived: true });
        });
        await batch.commit();
      }

      results.push({ postId, count: comments.length, path, committed: !dryRun });
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

export default router;
