import { getApiBaseUrl } from '@/utils/network/apiBase';
import { bearerAuth } from '@/lib/auth';

export type CreatePostPayload = {
  title: string;
  slug?: string;
  year?: string | number;
  content: string;
  frontmatter?: Record<string, unknown>;
  draft?: boolean;
};

export async function createPostPR(
  payload: CreatePostPayload,
  token: string
): Promise<{
  prUrl?: string;
  status?: 'pending' | 'succeeded';
  outboxId?: string;
  branch: string;
  path: string;
}> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/admin/create-post-pr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...bearerAuth(token),
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || 'Failed to create PR');
  }
  return json.data as {
    prUrl?: string;
    status?: 'pending' | 'succeeded';
    outboxId?: string;
    branch: string;
    path: string;
  };
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
  const normalizedBase = base.replace(/\/$/, '');
  const postId = `${params.year}/${params.slug}`;
  const uploadedItems: Array<{ url: string; variantWebp?: { url: string } | null }> = [];

  for (const file of files) {
    const directResult = await uploadPostImageDirect(normalizedBase, postId, file, token);
    if (directResult) {
      uploadedItems.push(directResult);
      continue;
    }
    if (uploadedItems.length > 0) {
      throw new Error('Direct image upload failed after partial completion');
    }
    return uploadPostImagesCompatibility(params, files, token);
  }

  return {
    dir: `/images/${postId}`,
    items: uploadedItems,
  };
}

async function uploadPostImageDirect(
  baseUrl: string,
  postId: string,
  file: File,
  token: string
): Promise<{ url: string; variantWebp?: { url: string } | null } | null> {
  const presign = await fetch(`${baseUrl}/api/v1/images/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...bearerAuth(token),
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      postId,
    }),
  });

  const presignJson = await presign.json().catch(() => ({}));
  if (!presign.ok || !presignJson?.ok || !presignJson?.data?.uploadUrl) {
    return null;
  }

  const uploadPath = String(presignJson.data.uploadUrl);
  const uploadUrl = uploadPath.startsWith('http')
    ? uploadPath
    : `${baseUrl}/api/v1${uploadPath.startsWith('/') ? uploadPath : `/${uploadPath}`}`;
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('postId', postId);

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: bearerAuth(token),
    body: formData,
  });

  const uploadJson = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok || !uploadJson?.ok || !uploadJson?.data?.url) {
    return null;
  }

  return {
    url: String(uploadJson.data.url),
    variantWebp: null,
  };
}

async function uploadPostImagesCompatibility(
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
    headers: bearerAuth(token),
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
