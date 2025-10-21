import { withCors, type Env } from './middleware/cors';
import { newSessionId } from './lib/id';

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    status: init?.status || 200,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return withCors(async (req, env) => {
      const url = new URL(req.url);

      // Health
      if (url.pathname === '/' && req.method === 'GET') {
        return json({ ok: true, service: 'ai-serve', model: env.DEFAULT_MODEL || 'gpt-4.1' });
      }

      // Create session: POST /session { title? }
      if (url.pathname === '/session' && req.method === 'POST') {
        // In v1.2, we're not persisting server-side. Client stores session id.
        const id = newSessionId();
        return json({ sessionID: id });
      }

      // Send message: POST /session/{id}/message
      const messageMatch = url.pathname.match(/^\/session\/([^/]+)\/message$/);
      if (messageMatch && req.method === 'POST') {
        const sessionID = messageMatch[1];
        // For v1.2, provider/model are fixed, authorization is not required
        const body = await req.json().catch(() => ({}));
        const { parts } = (body || {}) as { parts?: Array<{ type: string; text?: string }> };
        const text = parts?.find((p) => p.type === 'text')?.text;
        if (!text || typeof text !== 'string') {
          return json({ error: 'parts[0].text is required' }, { status: 400 });
        }

        // Streaming response (text/event-stream-like but plain chunks)
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const encoder = new TextEncoder();
            // Simulate chunked typing; replace with real provider call when wired
            const fake = `You said: ${text}`;
            for (const chunk of chunkString(fake, 24)) {
              controller.enqueue(encoder.encode(chunk));
              await sleep(60);
            }
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Session-ID': sessionID,
          },
        });
      }

      return json({ error: 'Not Found' }, { status: 404 });
    })(request, env);
  },
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunkString(str: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
  return out;
}
