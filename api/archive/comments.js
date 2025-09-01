import { db, Timestamp } from '../_lib/firebaseAdmin.js';
import { getOctokit, getRepoInfo, getCommitter } from '../_lib/octokit.js';
import { methodAllowed, json, getQuery } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['POST'])) return;

  const { dryRun } = getQuery(req);
  const cutoffDays = 90;
  const cutoffDate = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000);
  const cutoffTs = Timestamp.fromDate(cutoffDate);

  try {
    // Fetch non-archived comments older than cutoff
    const snap = await db
      .collection('comments')
      .where('archived', '==', false)
      .where('createdAt', '<=', cutoffTs)
      .get();

    if (snap.empty) {
      return json(res, 200, {
        archivedPosts: [],
        totalComments: 0,
        message: 'No comments to archive',
      });
    }

    // Group by postId
    const groups = new Map();
    snap.forEach(doc => {
      const data = doc.data();
      const pid = String(data.postId);
      if (!groups.has(pid)) groups.set(pid, []);
      groups.get(pid).push({ id: doc.id, data });
    });

    const octokit = getOctokit();
    const { owner, repo, baseBranch } = getRepoInfo();
    const { name, email } = getCommitter();

    let total = 0;
    const results = [];

    for (const [postId, items] of groups.entries()) {
      // Build JSON content ordered by createdAt asc
      const comments = items
        .map(({ id, data }) => ({
          id,
          postId: data.postId,
          author: data.author,
          content: data.content,
          website: data.website || null,
          parentId: data.parentId || null,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : null,
        }))
        .sort((a, b) => {
          const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
          const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
          return ta - tb;
        });

      total += comments.length;

      const path = `src/data/comments/${postId}.json`;
      const contentStr = `${JSON.stringify({ comments }, null, 2)}\n`;

      if (dryRun === '1') {
        results.push({
          postId,
          count: comments.length,
          path,
          committed: false,
        });
        continue;
      }

      // get existing sha if any
      let sha;
      try {
        const existing = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: baseBranch,
        });
        if (!Array.isArray(existing.data)) sha = existing.data.sha;
      } catch (_) {
        // not found OK
      }

      // commit file
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: `chore(archive): comments for ${postId} (${comments.length})`,
        content: Buffer.from(contentStr, 'utf8').toString('base64'),
        branch: baseBranch,
        committer: { name, email },
        author: { name, email },
        sha,
      });

      // mark as archived
      const batch = db.batch();
      items.forEach(({ id }) => {
        const ref = db.collection('comments').doc(id);
        batch.update(ref, { archived: true });
      });
      await batch.commit();

      results.push({ postId, count: comments.length, path, committed: true });
    }

    // trigger deploy hook if configured
    const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
    if (hook && dryRun !== '1') {
      try {
        await fetch(hook, { method: 'POST' });
      } catch (_) {
        // ignore hook errors
      }
    }

    return json(res, 200, { archivedPosts: results, totalComments: total });
  } catch (err) {
    return json(res, 500, {
      error: 'Failed to archive comments',
      details: String(err),
    });
  }
}
