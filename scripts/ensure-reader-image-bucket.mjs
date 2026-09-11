// Reader images are private; only the authenticated Worker serves their bytes.
// API: https://developers.cloudflare.com/api/resources/r2/subresources/buckets/
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const bucket = 'blog-reader-images-prod';
if (!account || !token) throw new Error('Cloudflare deployment credentials are missing');

async function request(path, { method = 'GET', body, allowMissing = false } = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30_000),
  });
  if (allowMissing && response.status === 404) return null;
  const data = await response.json();
  if (!response.ok || data.success !== true) {
    throw new Error(`R2 ${method} ${path}: HTTP ${response.status}, codes ${data.errors?.map(item => item.code).join(',')}`);
  }
  return data.result;
}

if (!await request(`/${bucket}`, { allowMissing: true })) {
  await request('', { method: 'POST', body: { name: bucket, locationHint: 'apac' } });
  console.log(`Created ${bucket}`);
}
let managed = await request(`/${bucket}/domains/managed`);
if (managed.enabled) {
  managed = await request(`/${bucket}/domains/managed`, { method: 'PUT', body: { enabled: false } });
}
const custom = await request(`/${bucket}/domains/custom`);
if (managed.enabled !== false || !Array.isArray(custom.domains) || custom.domains.some(domain => domain.enabled)) {
  throw new Error('Reader image bucket must have all public access disabled');
}
console.log(`${bucket}: private access verified`);
