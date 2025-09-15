import { Router } from 'express';
import { Octokit } from '@octokit/rest';
import { config } from '../config.js';

const router = Router();

function requireAdmin(req, res, next) {
  const required = !!config.admin.bearerToken;
  if (!required) return next();
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (token && token === config.admin.bearerToken) return next();
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}

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
    const repoInfo = await octokit.repos.get({ owner, repo });
    const baseBranch = repoInfo.data.default_branch || 'main';

    // base ref
    const baseRef = await octokit.git.getRef({
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
    await octokit.git.createRef({
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
    const destPath = `public${proposedName}`.replace(/^\/+/, '');

    // commit file content
    const contentBase64 = Buffer.from(markdown, 'utf-8').toString('base64');
    const message = `propose: ${year}/${slug} (${stamp})\n\nsource: ${sourcePage || ''}`;

    await octokit.repos.createOrUpdateFileContents({
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

    const pr = await octokit.pulls.create({
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

export default router;
