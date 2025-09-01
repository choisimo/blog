export function methodAllowed(req, res, methods) {
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    json(res, 405, { error: 'Method Not Allowed' });
    return false;
  }
  return true;
}

export async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export async function readJson(req) {
  const body = await readBody(req);
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (e) {
    throw new Error('Invalid JSON body');
  }
}

export function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function getQuery(req) {
  const url = new URL(req.url, 'http://localhost');
  const params = Object.fromEntries(url.searchParams.entries());
  return params;
}
