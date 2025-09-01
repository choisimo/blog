import { getOctokit, getRepoInfo, getCommitter } from './_lib/octokit.js';
import { methodAllowed, readJson, json } from './_lib/http.js';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['POST'])) return;
  try {
    const body = await readJson(req);
    const { path, content, message, title, branchName } = body || {};

    if (!path || typeof path !== 'string')
      return json(res, 400, { error: 'path is required' });
    if (typeof content !== 'string')
      return json(res, 400, { error: 'content must be string' });

    const octokit = getOctokit();
    const { owner, repo, baseBranch } = getRepoInfo();

    // Get base branch SHA
    const baseRef = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    });
    const baseSha = baseRef.data.object.sha;

    // Create a new branch
    const slug =
      path
        .replace(/[^a-zA-Z0-9-_/.]/g, '-')
        .replace(/[\/]/g, '_')
        .slice(0, 50) || 'update';
    let newBranch = branchName || `propose/new-version-${slug}-${Date.now()}`;
    try {
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${newBranch}`,
        sha: baseSha,
      });
    } catch (e) {
      // If branch exists or invalid, append random suffix
      newBranch = `${newBranch}-${Math.random().toString(36).slice(2, 8)}`;
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${newBranch}`,
        sha: baseSha,
      });
    }

    // Determine if file exists to get sha
    let existingSha;
    try {
      const existing = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: baseBranch,
      });
      if (!Array.isArray(existing.data) && existing.data && existing.data.sha) {
        existingSha = existing.data.sha;
      }
    } catch (_) {
      // Not found is fine
    }

    const { name, email } = getCommitter();
    const encoded = Buffer.from(content, 'utf8').toString('base64');
    const commitMessage = message || `docs: propose new version for ${path}`;

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: commitMessage,
      content: encoded,
      branch: newBranch,
      committer: { name, email },
      author: { name, email },
      sha: existingSha,
    });

    const prTitle = title || `Propose new version: ${path}`;
    const pr = await octokit.rest.pulls.create({
      owner,
      repo,
      title: prTitle,
      head: newBranch,
      base: baseBranch,
      body: 'Automated PR created by Vercel serverless function.',
    });

    return json(res, 200, { url: pr.data.html_url, number: pr.data.number });
  } catch (err) {
    return json(res, 500, {
      error: 'Failed to propose new version',
      details: String(err),
    });
  }
}
