export default {
  async fetch(request: Request, env: { MY_BUCKET: R2Bucket }): Promise<Response> {
    const url = new URL(request.url);
    const key = url.pathname.replace(/^\/+/, "");

    if (!key) {
      return new Response("Missing object key", { status: 400 });
    }

    // Access control: allow only requests that originate from the blog domain
    const referer = request.headers.get("Referer");
    if (!referer || !referer.startsWith("https://noblog.nodove.com/")) {
      return new Response("허용되지 않은 접근입니다.", { status: 403 });
    }

    // Fetch object from R2
    const object = await env.MY_BUCKET.get(key);
    if (object === null) {
      return new Response("객체를 찾을 수 없습니다.", { status: 404 });
    }

    const etag = object.httpEtag;
    const ifNoneMatch = request.headers.get("If-None-Match");
    if (ifNoneMatch && etag && ifNoneMatch.replace(/W\//, "") === etag.replace(/W\//, "")) {
      // Client has the same ETag — return 304 without body
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
    headers.set("etag", etag);

    // Encourage CDN/browser caching; Cache Rules can still override edge TTL
    if (!headers.has("Cache-Control")) {
      headers.set("Cache-Control", "public, max-age=0, s-maxage=604800, stale-while-revalidate=86400");
    }
    headers.set("Accept-Ranges", "bytes");

    // Support HEAD requests by returning headers only
    if (request.method === "HEAD") {
      return new Response(null, { headers });
    }

    return new Response(object.body, { headers });
  },
};
