import { Octokit } from '@octokit/rest';

export function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('Missing GITHUB_TOKEN');
  }
  return new Octokit({ auth: token });
}

export function getRepoInfo() {
  const repoStr = process.env.GITHUB_REPO;
  if (!repoStr) throw new Error('Missing GITHUB_REPO (expected "owner/repo")');
  const [owner, repo] = repoStr.split('/');
  if (!owner || !repo)
    throw new Error('GITHUB_REPO must be in the form "owner/repo"');
  const baseBranch = process.env.GITHUB_DEFAULT_BRANCH || 'main';
  return { owner, repo, baseBranch };
}

export function getCommitter() {
  const name = process.env.GIT_USER_NAME || 'vercel-bot';
  const email = process.env.GIT_USER_EMAIL || 'vercel-bot@local';
  return { name, email };
}
