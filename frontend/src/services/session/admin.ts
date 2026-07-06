import { getApiBaseUrl } from '@/utils/network/apiBase';
import { adminFetchRaw } from '@/services/admin/apiClient';

export type CreatePostPayload = {
  title: string;
  slug?: string;
  year?: string | number;
  content: string;
  frontmatter?: Record<string, unknown>;
  draft?: boolean;
};

const MAX_CREATE_POST_TITLE_LENGTH = 200;
const MAX_CREATE_POST_CONTENT_LENGTH = 1_000_000;
const MAX_ADMIN_IMAGE_PATH_LENGTH = 512;
const MAX_ADMIN_ERROR_MESSAGE_LENGTH = 1000;
const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const SINGLE_LINE_CONTROL_TEST_PATTERN = /[\u0000-\u001F\u007F]/;
const ENCODED_SINGLE_LINE_CONTROL_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const MULTILINE_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const WHITESPACE_PATTERN = /\s+/g;

function getAdminErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as { error?: unknown; message?: unknown };
  const errorText = normalizeSingleLineText(record.error, MAX_ADMIN_ERROR_MESSAGE_LENGTH);
  if (errorText) return errorText;
  if (record.error && typeof record.error === 'object') {
    const nested = record.error as { message?: unknown; code?: unknown };
    const nestedMessage = normalizeSingleLineText(nested.message, MAX_ADMIN_ERROR_MESSAGE_LENGTH);
    if (nestedMessage) return nestedMessage;
    const nestedCode = normalizeSingleLineText(nested.code, MAX_ADMIN_ERROR_MESSAGE_LENGTH);
    if (nestedCode) return nestedCode;
  }
  return normalizeSingleLineText(record.message, MAX_ADMIN_ERROR_MESSAGE_LENGTH) ?? fallback;
}

type CreatePostPrResponse = {
  prUrl?: string;
  status?: 'pending' | 'succeeded';
  outboxId?: string;
  branch: string;
  path: string;
};

type UploadedPostImageItem = {
  url: string;
  variantWebp?: { url: string } | null;
};

type UploadedPostImagesResponse = {
  dir: string;
  items: UploadedPostImageItem[];
};

function normalizeSafeAdminString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (
    !normalized ||
    SINGLE_LINE_CONTROL_TEST_PATTERN.test(normalized) ||
    ENCODED_SINGLE_LINE_CONTROL_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function normalizeSingleLineText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value
    .replace(SINGLE_LINE_CONTROL_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized && normalized.length <= maxLength ? normalized : null;
}

function normalizePostSlug(value: unknown): string | null {
  const normalized = normalizeSafeAdminString(value);
  if (!normalized) return null;
  const slug = normalized
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return slug || null;
}

function normalizePostYear(value: unknown): string | null {
  const normalized = normalizeSafeAdminString(String(value ?? ''));
  return normalized && /^[0-9]{4}$/.test(normalized) ? normalized : null;
}

function normalizeSingleLineField(
  value: unknown,
  label: string,
  maxLength: number
): string {
  const normalized = normalizeSingleLineText(value, maxLength);
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`Invalid create post ${label}`);
  }
  return normalized;
}

function normalizeMultilineField(
  value: unknown,
  label: string,
  maxLength: number
): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid create post ${label}`);
  }

  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replace(MULTILINE_CONTROL_PATTERN, ' ')
    .trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`Invalid create post ${label}`);
  }
  return normalized;
}

function normalizeCreatePostPayload(payload: CreatePostPayload): CreatePostPayload {
  const title = normalizeSingleLineField(payload.title, 'title', MAX_CREATE_POST_TITLE_LENGTH);
  const content = normalizeMultilineField(
    payload.content,
    'content',
    MAX_CREATE_POST_CONTENT_LENGTH
  );
  const slug = payload.slug === undefined ? undefined : normalizePostSlug(payload.slug);
  const year = payload.year === undefined ? undefined : normalizePostYear(payload.year);

  if (payload.slug !== undefined && !slug) {
    throw new Error('Invalid create post slug');
  }
  if (payload.year !== undefined && !year) {
    throw new Error('Invalid create post year');
  }
  if (
    payload.frontmatter !== undefined &&
    (!payload.frontmatter ||
      typeof payload.frontmatter !== 'object' ||
      Array.isArray(payload.frontmatter))
  ) {
    throw new Error('Invalid create post frontmatter');
  }

  return {
    title,
    content,
    ...(slug ? { slug } : {}),
    ...(year ? { year } : {}),
    ...(payload.frontmatter !== undefined ? { frontmatter: payload.frontmatter } : {}),
    ...(typeof payload.draft === 'boolean' ? { draft: payload.draft } : {}),
  };
}

function normalizeImageFile(file: File): File | null {
  const filename = normalizeSafeAdminString(file.name);
  const contentType = normalizeSafeAdminString(file.type);
  if (
    !filename ||
    !contentType?.startsWith('image/') ||
    !Number.isSafeInteger(file.size) ||
    file.size <= 0
  ) {
    return null;
  }
  return file;
}

function normalizeImagePath(value: unknown): string | null {
  const normalized = normalizeSafeAdminString(value);
  if (
    !normalized ||
    normalized.length > MAX_ADMIN_IMAGE_PATH_LENGTH ||
    !normalized.startsWith('/images/') ||
    normalized.includes('//') ||
    normalized.includes('/../') ||
    normalized.endsWith('/..')
  ) {
    return null;
  }
  return normalized;
}

function hasExplicitOrigin(input: string): boolean {
  return /^[a-z][a-z\d+\-.]*:/i.test(input) || input.startsWith('//');
}

function buildDirectUploadUrl(baseUrl: string, uploadUrl: unknown): string | null {
  const normalized = normalizeSafeAdminString(uploadUrl);
  if (!normalized) return null;

  try {
    const base = new URL(baseUrl);
    const parsed = new URL(normalized, base.origin);
    if (hasExplicitOrigin(normalized) && parsed.origin !== base.origin) {
      return null;
    }

    const pathAndQuery = `${parsed.pathname}${parsed.search}`;
    const imagePath = pathAndQuery.startsWith('/api/v1/')
      ? pathAndQuery.slice('/api/v1'.length)
      : pathAndQuery;
    if (!normalizeImagePath(imagePath)) {
      return null;
    }

    return `${baseUrl}/api/v1${imagePath}`;
  } catch {
    return null;
  }
}

function normalizeCreatePostPrResponse(
  value: unknown,
): CreatePostPrResponse | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as CreatePostPrResponse;
  const branch = normalizeSafeAdminString(record.branch);
  const path = normalizeSafeAdminString(record.path);
  if (!branch || !path) return null;

  return {
    ...record,
    prUrl: normalizeSafeAdminString(record.prUrl) ?? undefined,
    outboxId: normalizeSafeAdminString(record.outboxId) ?? undefined,
    branch,
    path,
  };
}

function normalizeUploadedPostImageItem(
  value: unknown,
): UploadedPostImageItem | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as UploadedPostImageItem;
  const url = normalizeImagePath(record.url);
  if (!url) return null;

  let variantWebp = record.variantWebp;
  if (variantWebp !== undefined && variantWebp !== null) {
    const webpUrl = normalizeImagePath(variantWebp.url);
    if (!webpUrl) return null;
    variantWebp = { url: webpUrl };
  }

  return {
    url,
    variantWebp,
  };
}

function normalizeUploadedPostImagesResponse(
  value: unknown,
): UploadedPostImagesResponse | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as UploadedPostImagesResponse;
  const dir = normalizeImagePath(record.dir);
  if (!dir || !Array.isArray(record.items)) return null;
  const items = record.items.flatMap((item) => {
    const normalized = normalizeUploadedPostImageItem(item);
    return normalized ? [normalized] : [];
  });
  if (items.length !== record.items.length) return null;

  return {
    dir,
    items,
  };
}

export async function createPostPR(
  payload: CreatePostPayload,
  _token?: string
): Promise<CreatePostPrResponse> {
  const normalizedPayload = normalizeCreatePostPayload(payload);
  const base = getApiBaseUrl();
  const res = await adminFetchRaw(`${base}/api/v1/admin/create-post-pr`, {
    method: 'POST',
    body: JSON.stringify(normalizedPayload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(getAdminErrorMessage(json, 'Failed to create PR'));
  }
  const data = normalizeCreatePostPrResponse(json.data);
  if (!data) {
    throw new Error('Create post PR returned an invalid response');
  }
  return data;
}

export async function uploadPostImages(
  params: { year: string | number; slug: string },
  files: File[],
  _token?: string
): Promise<{
  dir: string;
  items: Array<{ url: string; variantWebp?: { url: string } | null }>;
}> {
  const base = getApiBaseUrl();
  const normalizedBase = base.replace(/\/$/, '');
  const year = normalizePostYear(params.year);
  const slug = normalizePostSlug(params.slug);
  if (!year || !slug) {
    throw new Error('Invalid image upload path');
  }

  const imageFiles = files.map(normalizeImageFile);
  if (imageFiles.some((file) => file === null)) {
    throw new Error('Invalid image upload file');
  }

  const postId = `${year}/${slug}`;
  const uploadedItems: Array<{ url: string; variantWebp?: { url: string } | null }> = [];

  for (const file of imageFiles as File[]) {
    const directResult = await uploadPostImageDirect(normalizedBase, postId, file);
    if (directResult) {
      uploadedItems.push(directResult);
      continue;
    }
    if (uploadedItems.length > 0) {
      throw new Error('Direct image upload failed after partial completion');
    }
    return uploadPostImagesCompatibility({ year, slug }, imageFiles as File[]);
  }

  return {
    dir: `/images/${postId}`,
    items: uploadedItems,
  };
}

async function uploadPostImageDirect(
  baseUrl: string,
  postId: string,
  file: File
): Promise<{ url: string; variantWebp?: { url: string } | null } | null> {
  const presign = await adminFetchRaw(`${baseUrl}/api/v1/images/presign`, {
    method: 'POST',
    body: JSON.stringify({
      filename: normalizeSafeAdminString(file.name),
      contentType: normalizeSafeAdminString(file.type),
      postId,
    }),
  });

  const presignJson = await presign.json().catch(() => ({}));
  const presignUploadUrl = buildDirectUploadUrl(baseUrl, presignJson?.data?.uploadUrl);
  if (!presign.ok || !presignJson?.ok || !presignUploadUrl) {
    return null;
  }

  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('postId', postId);

  const uploadResponse = await adminFetchRaw(presignUploadUrl, {
    method: 'POST',
    body: formData,
  });

  const uploadJson = await uploadResponse.json().catch(() => ({}));
  const uploadedUrl = normalizeImagePath(uploadJson?.data?.url);
  if (!uploadResponse.ok || !uploadJson?.ok || !uploadedUrl) {
    return null;
  }

  return {
    url: uploadedUrl,
    variantWebp: null,
  };
}

async function uploadPostImagesCompatibility(
  params: { year: string | number; slug: string },
  files: File[]
): Promise<{
  dir: string;
  items: Array<{ url: string; variantWebp?: { url: string } | null }>;
}> {
  const base = getApiBaseUrl();
  const fd = new FormData();
  const year = normalizePostYear(params.year);
  const slug = normalizePostSlug(params.slug);
  if (!year || !slug) {
    throw new Error('Invalid image upload path');
  }

  fd.append('year', year);
  fd.append('slug', slug);
  for (const f of files) fd.append('files', f, f.name);

  const res = await adminFetchRaw(`${base}/api/v1/images/upload`, {
    method: 'POST',
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(getAdminErrorMessage(json, 'Failed to upload'));
  }
  const data = normalizeUploadedPostImagesResponse(json.data);
  if (!data) {
    throw new Error('Image upload returned an invalid response');
  }
  return data;
}
