type Env = {
  MY_BUCKET: R2Bucket;
  INTERNAL_CALLER_KEY?: string;
  ALLOWED_INTERNAL_ORIGINS?: string;
  ALLOWED_ORIGINS?: string;
};

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const ALLOWED_METHODS = ["GET", "HEAD", "OPTIONS"];
const MAX_LIST_PAGE_SIZE = 100;

// Public prefixes - these paths are publicly accessible without authentication
const PUBLIC_PREFIXES = ["ai-chat/", "images/", "posts/", "assets/"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function sanitizeEtag(etag?: string | null) {
  return etag?.replace(/"/g, "") ?? null;
}

function buildJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { ...JSON_HEADERS, ...(init?.headers || {}) },
  });
}

function applyCorsHeaders(headers: Headers, origin: string, env: Env) {
  const allowedOrigins = (env.ALLOWED_ORIGINS || "*").split(",").map((o) => o.trim());
  
  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", allowedOrigins.includes("*") ? "*" : origin);
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, If-None-Match");
    headers.set("Access-Control-Max-Age", "86400");
  }
}

async function handleAssetRequest(request: Request, env: Env, key: string) {
  const origin = request.headers.get("Origin") || "*";

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    const response = new Response(null, { status: 204 });
    applyCorsHeaders(response.headers, origin, env);
    return response;
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const object = await env.MY_BUCKET.get(key);
  if (!object) {
    const notFoundResponse = new Response("Object not found", { status: 404 });
    applyCorsHeaders(notFoundResponse.headers, origin, env);
    return notFoundResponse;
  }

  const etag = object.httpEtag;
  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch && etag && ifNoneMatch.replace(/W\//, "") === etag.replace(/W\//, "")) {
    const cachedResponse = new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
    applyCorsHeaders(cachedResponse.headers, origin, env);
    return cachedResponse;
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", etag ?? "");
  // Long cache for immutable assets
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Accept-Ranges", "bytes");
  applyCorsHeaders(headers, origin, env);

  if (request.method === "HEAD") {
    return new Response(null, { headers });
  }

  return new Response(object.body, { headers });
}

function isInternalCall(request: Request, env: Env): boolean {
  const key = request.headers.get("X-Gateway-Caller-Key") || "";
  if (env.INTERNAL_CALLER_KEY && key === env.INTERNAL_CALLER_KEY) {
    return true;
  }
  const referer = request.headers.get("Referer") || "";
  if (!referer) return false;
  if (!env.ALLOWED_INTERNAL_ORIGINS) return false;
  return env.ALLOWED_INTERNAL_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean)
    .some((allowed) => referer.startsWith(allowed));
}

async function handleInternalRequest(
  request: Request,
  env: Env,
  resource: string,
  userId: string,
  id?: string
) {
  if (!isInternalCall(request, env)) {
    return buildJsonResponse({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") || undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(MAX_LIST_PAGE_SIZE, Math.max(parseInt(limitParam, 10) || 0, 1)) : MAX_LIST_PAGE_SIZE;
  const sanitizedId = id?.replace(/\.json$/i, "");
  const objectKey = sanitizedId ? `${resource}/${userId}/${sanitizedId}.json` : `${resource}/${userId}/`;

  if (request.method === "GET" && !sanitizedId) {
    const result = await env.MY_BUCKET.list({
      prefix: `${resource}/${userId}/`,
      cursor,
      limit,
    });

    const responseBody = {
      ok: true,
      cursor: (result as { cursor?: string }).cursor ?? null,
      truncated: result.truncated ?? false,
      objects: result.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        httpEtag: sanitizeEtag(obj.httpEtag),
        uploaded: obj.uploaded?.toISOString?.() ?? null,
      })),
      delimitedPrefixes: result.delimitedPrefixes ?? [],
    };

    return buildJsonResponse(responseBody);
  }

  if (!sanitizedId) {
    return buildJsonResponse({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  switch (request.method) {
    case "GET": {
      const object = await env.MY_BUCKET.get(objectKey);
      if (!object) {
        return buildJsonResponse({ ok: false, error: "Not found" }, { status: 404 });
      }

      const headers = new Headers(JSON_HEADERS);
      object.writeHttpMetadata(headers);
      headers.set("ETag", sanitizeEtag(object.httpEtag) ?? "");

      return new Response(object.body, { status: 200, headers });
    }
    case "HEAD": {
      const object = await env.MY_BUCKET.get(objectKey);
      if (!object) {
        return buildJsonResponse({ ok: false, error: "Not found" }, { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("ETag", sanitizeEtag(object.httpEtag) ?? "");
      return new Response(null, { status: 200, headers });
    }
    case "PUT": {
      const ifMatch = request.headers.get("If-Match")?.replace(/^"|"$/g, "");
      const existing = await env.MY_BUCKET.get(objectKey);
      const existingEtag = sanitizeEtag(existing?.httpEtag);
      if (ifMatch && existingEtag && ifMatch !== existingEtag) {
        return buildJsonResponse({ ok: false, error: "ETag mismatch" }, { status: 412 });
      }
      if (ifMatch && !existing) {
        return buildJsonResponse({ ok: false, error: "Missing resource" }, { status: 412 });
      }

      const text = await request.text();
      const result = await env.MY_BUCKET.put(objectKey, text, {
        httpMetadata: { contentType: "application/json" },
      });
      return buildJsonResponse({ ok: true, etag: sanitizeEtag(result.httpEtag) }, {
        status: existing ? 200 : 201,
      });
    }
    case "DELETE": {
      const ifMatch = request.headers.get("If-Match")?.replace(/^"|"$/g, "");
      if (ifMatch) {
        const existing = await env.MY_BUCKET.get(objectKey);
        const existingEtag = sanitizeEtag(existing?.httpEtag);
        if (!existing) {
          return buildJsonResponse({ ok: false, error: "Missing resource" }, { status: 412 });
        }
        if (existingEtag && existingEtag !== ifMatch) {
          return buildJsonResponse({ ok: false, error: "ETag mismatch" }, { status: 412 });
        }
      }
      await env.MY_BUCKET.delete(objectKey);
      return new Response(null, { status: 204 });
    }
    default:
      return buildJsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/^\/+/, "");
    const origin = request.headers.get("Origin") || "*";

    // Handle CORS preflight for any path
    if (request.method === "OPTIONS") {
      const response = new Response(null, { status: 204 });
      applyCorsHeaders(response.headers, origin, env);
      return response;
    }
    
    // Root path - return simple status
    if (!pathname) {
      const statusResponse = buildJsonResponse({ ok: true, service: "r2-gateway" });
      applyCorsHeaders(statusResponse.headers, origin, env);
      return statusResponse;
    }

    // Legacy /assets/* path - strip prefix and serve
    if (pathname.startsWith("assets/")) {
      return handleAssetRequest(request, env, pathname.replace(/^assets\//, ""));
    }

    // Public paths - serve directly without /assets/ prefix
    // This allows URLs like /ai-chat/2025/image.png to work
    if (isPublicPath(pathname)) {
      return handleAssetRequest(request, env, pathname);
    }

    // Internal API paths - require authentication
    if (pathname.startsWith("internal/")) {
      const [, resource, userId, ...rest] = pathname.split("/");
      if (!resource || !userId) {
        return buildJsonResponse({ ok: false, error: "Invalid path" }, { status: 400 });
      }
      const id = rest.length > 0 ? rest.join("/") : undefined;
      return handleInternalRequest(request, env, resource, userId, id);
    }

    const notFoundResponse = new Response(JSON.stringify({ ok: false, error: "Not Found" }), {
      status: 404,
      headers: JSON_HEADERS,
    });
    applyCorsHeaders(notFoundResponse.headers, origin, env);
    return notFoundResponse;
  },
};
