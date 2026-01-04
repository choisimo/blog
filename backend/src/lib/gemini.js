import { config } from '../config.js';

export async function generateContent(prompt, { temperature = 0.2 } = {}) {
  const apiKey = config.gemini.apiKey;
  const model = config.gemini.model || 'gemini-2.0-flash';
  if (!apiKey) {
    const err = new Error('Server not configured: GEMINI_API_KEY missing');
    err.status = 500;
    throw err;
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: String(prompt || '') }],
      },
    ],
    generationConfig: { temperature },
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const details = await resp.text().catch(() => '');
    const err = new Error(
      `Gemini API error(${resp.status}) ${details.slice(0, 400)}`
    );
    err.status = 502;
    throw err;
  }
  const data = await resp.json();
  const summary = (data?.candidates?.[0]?.content?.parts || [])
    .map(p => (p && typeof p === 'object' && 'text' in p ? p.text : ''))
    .filter(Boolean)
    .join('\n');
  return summary;
}

export function tryParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    try {
      return JSON.parse(fence[1]);
    } catch {}
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const maybe = text.slice(start, end + 1);
    try {
      return JSON.parse(maybe);
    } catch {}
  }
  return null;
}
