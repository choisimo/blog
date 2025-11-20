type Env = {
  MY_BUCKET: R2Bucket;
  INTERNAL_CALLER_KEY?: string;
  ALLOWED_INTERNAL_ORIGINS?: string;
};

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const ALLOWED_METHODS = ["GET", "HEAD"];
const MAX_LIST_PAGE_SIZE = 100;

function sanitizeEtag(etag?: string | null) {
  return etag?.replace(/"/g, "") ?? null;
}

function buildJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { ...JSON_HEADERS, ...(init?.headers || {}) },
  });
}

async function handleAssetRequest(request: Request, env: Env, key: string) {
  if (!ALLOWED_METHODS.includes(request.method)) {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const object = await env.MY_BUCKET.get(key);
  if (!object) {
    return new Response("객체를 찾을 수 없습니다.", { status: 404 });
  }

  const etag = object.httpEtag;
  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch && etag && ifNoneMatch.replace(/W\//, "") === etag.replace(/W\//, "")) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=0, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", etag ?? "");
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "public, max-age=0, s-maxage=604800, stale-while-revalidate=86400");
  }
  headers.set("Accept-Ranges", "bytes");

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
    if (!pathname) {
      return new Response("Missing object key", { status: 400 });
    }

    if (pathname.startsWith("assets/")) {
      return handleAssetRequest(request, env, pathname.replace(/^assets\//, ""));
    }

    if (pathname.startsWith("internal/")) {
      const [, resource, userId, ...rest] = pathname.split("/");
      if (!resource || !userId) {
        return buildJsonResponse({ ok: false, error: "Invalid path" }, { status: 400 });
      }
      const id = rest.length > 0 ? rest.join("/") : undefined;
      return handleInternalRequest(request, env, resource, userId, id);
    }

    return new Response(JSON.stringify({ ok: false, error: "Not Found" }), {
      status: 404,
      headers: JSON_HEADERS,
    });
  },
};
