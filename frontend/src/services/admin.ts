import { getApiBaseUrl } from '@/utils/apiBase';

export type CreatePostPayload = {
  title: string;
  slug?: string;
  year?: string | number;
  content: string;
  frontmatter?: Record<string, any>;
  draft?: boolean;
};

export async function adminLogin(
  username: string,
  password: string
): Promise<string> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || 'Login failed');
  }
  const token = json.data?.token as string;
  if (!token) throw new Error('No token returned');
  return token;
}

export async function createPostPR(
  payload: CreatePostPayload,
  token: string
): Promise<{ prUrl: string; branch: string; path: string }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/admin/create-post-pr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || 'Failed to create PR');
  }
  return json.data as { prUrl: string; branch: string; path: string };
}

export async function uploadPostImages(
  params: { year: string | number; slug: string },
  files: File[],
  token: string
): Promise<{
  dir: string;
  items: Array<{ url: string; variantWebp?: { url: string } | null }>;
}> {
  const base = getApiBaseUrl();
  const fd = new FormData();
  fd.append('year', String(params.year));
  fd.append('slug', params.slug);
  for (const f of files) fd.append('files', f, f.name);

  const res = await fetch(`${base}/api/v1/images/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || 'Failed to upload');
  }
  return json.data as {
    dir: string;
    items: Array<{ url: string; variantWebp?: { url: string } | null }>;
  };
}
