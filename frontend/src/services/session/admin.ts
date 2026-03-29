import { getApiBaseUrl } from "@/utils/network/apiBase";
import { bearerAuth } from "@/lib/auth";

export type CreatePostPayload = {
  title: string;
  slug?: string;
  year?: string | number;
  content: string;
  frontmatter?: Record<string, unknown>;
  draft?: boolean;
};

export type UploadedPostImage = {
  url: string;
  markdownPath: string;
  previewUrl: string;
  thumbPreviewUrl?: string | null;
  size?: number;
  sizeBytes?: number;
  width?: number | null;
  height?: number | null;
  variantWebp?: { url: string } | null;
};

export async function createPostPR(
  payload: CreatePostPayload,
  token: string,
): Promise<{ prUrl: string; branch: string; path: string }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/admin/create-post-pr`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...bearerAuth(token),
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Failed to create PR");
  }
  return json.data as { prUrl: string; branch: string; path: string };
}

export async function uploadPostImages(
  params: { year: string | number; slug: string },
  files: File[],
  token: string,
): Promise<{
  dir: string;
  items: UploadedPostImage[];
}> {
  const base = getApiBaseUrl();
  const fd = new FormData();
  fd.append("year", String(params.year));
  fd.append("slug", params.slug);
  for (const f of files) fd.append("files", f, f.name);

  const res = await fetch(`${base}/api/v1/images/upload`, {
    method: "POST",
    headers: bearerAuth(token),
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Failed to upload");
  }
  return json.data as {
    dir: string;
    items: UploadedPostImage[];
  };
}
