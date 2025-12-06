/**
 * Cloudflare R2 HTTP API Client
 *
 * Uses Cloudflare's REST API to access R2 storage.
 * Requires: CF_ACCOUNT_ID, CF_API_TOKEN, R2_BUCKET_NAME
 *
 * API: https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets/{bucket_name}/objects/{key}
 */

// Get credentials from environment
const getCredentials = () => {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  const bucketName = process.env.R2_BUCKET_NAME || 'blog';
  const assetsBaseUrl = process.env.R2_ASSETS_BASE_URL || 'https://assets-b.nodove.com';

  if (!accountId || !apiToken) {
    throw new Error('R2 credentials not configured. Set CF_ACCOUNT_ID, CF_API_TOKEN');
  }

  return { accountId, apiToken, bucketName, assetsBaseUrl };
};

/**
 * Check if R2 is configured
 * @returns {boolean}
 */
export function isR2Configured() {
  try {
    getCredentials();
    return true;
  } catch {
    return false;
  }
}

/**
 * Upload a file to R2
 * @param {string} key - Object key (path in bucket)
 * @param {Buffer|ArrayBuffer|Uint8Array} data - File data
 * @param {object} options - Upload options
 * @returns {Promise<{key: string, url: string, size: number}>}
 */
export async function upload(key, data, options = {}) {
  const { accountId, apiToken, bucketName, assetsBaseUrl } = getCredentials();

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${encodeURIComponent(key)}`;

  const headers = {
    Authorization: `Bearer ${apiToken}`,
  };

  if (options.contentType) {
    headers['Content-Type'] = options.contentType;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: data,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`R2 upload failed (${response.status}): ${text}`);
  }

  const size = data.byteLength || data.length || 0;
  const publicUrl = `${assetsBaseUrl.replace(/\/$/, '')}/${key}`;

  return {
    key,
    url: publicUrl,
    size,
    contentType: options.contentType || 'application/octet-stream',
  };
}

/**
 * Delete an object from R2
 * @param {string} key - Object key
 * @returns {Promise<{deleted: boolean}>}
 */
export async function deleteObject(key) {
  const { accountId, apiToken, bucketName } = getCredentials();

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`R2 delete failed (${response.status}): ${text}`);
  }

  return { deleted: true };
}

/**
 * Get object metadata from R2
 * @param {string} key - Object key
 * @returns {Promise<object|null>}
 */
export async function head(key) {
  const { accountId, apiToken, bucketName } = getCredentials();

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`R2 head failed (${response.status}): ${text}`);
  }

  return {
    key,
    size: parseInt(response.headers.get('content-length') || '0', 10),
    contentType: response.headers.get('content-type'),
    etag: response.headers.get('etag'),
  };
}

/**
 * Generate a unique key for uploads
 * @param {string} filename - Original filename
 * @param {string} prefix - Key prefix (e.g., 'ai-chat', 'posts')
 * @returns {string}
 */
export function generateKey(filename, prefix = 'uploads') {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  const timestamp = Date.now();
  const year = new Date().getFullYear();
  return `${prefix}/${year}/${timestamp}-${sanitized}`;
}
