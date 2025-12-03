// workers/ai-vision-gateway/src/index.ts
// Cloudflare Worker for image analysis using multiple AI providers (Gemini, OpenRouter)

type Env = {
  ALLOWED_ORIGINS?: string;
  // API Keys stored in KV
  VISION_KV: KVNamespace;
  // Or direct secrets as fallback
  GEMINI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
};

type VisionProvider = 'gemini' | 'openrouter';

interface AnalysisRequest {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  prompt?: string;
  provider?: VisionProvider;
}

interface AnalysisResponse {
  ok: boolean;
  description?: string;
  provider?: VisionProvider;
  error?: string;
}

const JSON_CONTENT_TYPE = { 'Content-Type': 'application/json' } as const;

const DEFAULT_PROMPT = `이 이미지를 분석해주세요. 다음 내용을 간결하게 설명해주세요:
1. 이미지에 보이는 주요 요소들
2. 전체적인 분위기나 맥락
3. 텍스트가 있다면 해당 내용

한국어로 2-3문장으로 간결하게 요약해주세요.`;

function applyCors(headers: Headers, origin: string, requestHeaders?: string | null) {
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin, Access-Control-Request-Headers, Access-Control-Request-Method');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  const incoming = (requestHeaders || '').split(',').map(s => s.trim()).filter(Boolean);
  const base = ['Content-Type', 'Authorization', 'X-API-Key'];
  const merged = Array.from(new Set([...base, ...incoming])).join(', ');
  headers.set('Access-Control-Allow-Headers', merged);
  headers.set('Access-Control-Max-Age', '600');
}

function isAllowedOrigin(origin: string, allowedOrigins: string): boolean {
  const allowed = allowedOrigins.split(',').map(s => s.trim()).filter(Boolean);
  return allowed.includes('*') || allowed.includes(origin);
}

function makeResponse(body: AnalysisResponse, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { ...JSON_CONTENT_TYPE, ...(init?.headers || {}) },
  });
}

// Get API key from KV or fallback to env secret
async function getApiKey(env: Env, provider: VisionProvider): Promise<string | null> {
  // Try KV first
  const kvKey = `api_key_${provider}`;
  let apiKey = await env.VISION_KV?.get(kvKey);
  
  // Fallback to env secrets
  if (!apiKey) {
    if (provider === 'gemini') apiKey = env.GEMINI_API_KEY || null;
    if (provider === 'openrouter') apiKey = env.OPENROUTER_API_KEY || null;
  }
  
  return apiKey;
}

// Fetch image and convert to base64
async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  
  return { base64, mimeType: contentType };
}

// Gemini Vision API
async function analyzeWithGemini(
  env: Env,
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const apiKey = await getApiKey(env, 'gemini');
  if (!apiKey) throw new Error('Gemini API key not configured');

  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = await response.json<{
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  }>();

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No content in Gemini response');
  return text;
}

// OpenRouter Vision API (supports multiple models like GPT-4V, Claude 3, etc.)
async function analyzeWithOpenRouter(
  env: Env,
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const apiKey = await getApiKey(env, 'openrouter');
  if (!apiKey) throw new Error('OpenRouter API key not configured');

  // Use free vision model: Nemotron Nano 12B VL
  const model = 'nvidia/nemotron-nano-12b-v2-vl:free';
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://blog.nodove.com',
      'X-Title': 'Blog AI Vision',
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
          { type: 'text', text: prompt },
        ],
      }],
      max_tokens: 512,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = await response.json<{
    choices?: Array<{ message?: { content?: string } }>;
  }>();

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No content in OpenRouter response');
  return text;
}

// Main analysis function with fallback
async function analyzeImage(
  env: Env,
  imageBase64: string,
  mimeType: string,
  prompt: string,
  preferredProvider?: VisionProvider
): Promise<{ description: string; provider: VisionProvider }> {
  const providers: VisionProvider[] = preferredProvider
    ? [preferredProvider, ...(preferredProvider === 'gemini' ? ['openrouter'] : ['gemini']) as VisionProvider[]]
    : ['gemini', 'openrouter'];

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      let description: string;
      
      if (provider === 'gemini') {
        description = await analyzeWithGemini(env, imageBase64, mimeType, prompt);
      } else {
        description = await analyzeWithOpenRouter(env, imageBase64, mimeType, prompt);
      }

      return { description, provider };
    } catch (err) {
      lastError = err as Error;
      console.error(`Provider ${provider} failed:`, lastError.message);
      // Continue to next provider
    }
  }

  throw lastError || new Error('All vision providers failed');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = env.ALLOWED_ORIGINS || '';
    const isBrowserAllowed = !!origin && isAllowedOrigin(origin, allowedOrigins);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      if (!isBrowserAllowed) {
        return makeResponse({ ok: false, error: 'Forbidden: Invalid origin' }, { status: 403 });
      }
      const res = new Response(null, { status: 204 });
      applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
      return res;
    }

    // Only allow POST
    if (request.method !== 'POST') {
      const res = makeResponse({ ok: false, error: 'Method not allowed' }, { status: 405 });
      if (isBrowserAllowed && origin) applyCors(res.headers, origin);
      return res;
    }

    // Validate origin for browser requests
    if (origin && !isBrowserAllowed) {
      return makeResponse({ ok: false, error: 'Forbidden: Invalid origin' }, { status: 403 });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check
      if (path === '/health') {
        const res = makeResponse({ ok: true });
        if (isBrowserAllowed && origin) applyCors(res.headers, origin);
        return res;
      }

      // Main analysis endpoint: POST /analyze
      if (path === '/analyze') {
        const body = await request.json<AnalysisRequest>();
        
        let imageBase64: string;
        let mimeType: string;

        // Get image data either from base64 or URL
        if (body.imageBase64) {
          imageBase64 = body.imageBase64;
          mimeType = body.mimeType || 'image/jpeg';
        } else if (body.imageUrl) {
          const fetched = await fetchImageAsBase64(body.imageUrl);
          imageBase64 = fetched.base64;
          mimeType = fetched.mimeType;
        } else {
          const res = makeResponse({ ok: false, error: 'imageUrl or imageBase64 required' }, { status: 400 });
          if (isBrowserAllowed && origin) applyCors(res.headers, origin);
          return res;
        }

        const prompt = body.prompt || DEFAULT_PROMPT;
        const result = await analyzeImage(env, imageBase64, mimeType, prompt, body.provider);

        const res = makeResponse({
          ok: true,
          description: result.description,
          provider: result.provider,
        });
        if (isBrowserAllowed && origin) applyCors(res.headers, origin);
        return res;
      }

      // 404 for unknown paths
      const res = makeResponse({ ok: false, error: 'Not found' }, { status: 404 });
      if (isBrowserAllowed && origin) applyCors(res.headers, origin);
      return res;
    } catch (err) {
      console.error('Vision analysis error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      const res = makeResponse({ ok: false, error: message }, { status: 500 });
      if (isBrowserAllowed && origin) applyCors(res.headers, origin);
      return res;
    }
  },
};
