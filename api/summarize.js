import { methodAllowed, readJson, json } from './_lib/http.js';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['POST'])) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 500, {
      error: 'Server not configured: GEMINI_API_KEY missing',
    });
  }

  try {
    const body = await readJson(req);
    const { text, input, instructions } = body || {};
    const contentText = text || input;
    if (!contentText) {
      return json(res, 400, { error: 'Missing text' });
    }

    const prompt = instructions
      ? `${instructions}\n\n---\n\n${contentText}`
      : `Summarize the following content in Korean, concise but faithful to key points.\n\n${contentText}`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    if (!resp.ok) {
      const details = await resp.text();
      return json(res, 502, { error: 'Gemini API error', details });
    }

    const data = await resp.json();
    const summary = (data?.candidates?.[0]?.content?.parts || [])
      .map(p => p.text)
      .filter(Boolean)
      .join('\n');

    return json(res, 200, { summary });
  } catch (err) {
    return json(res, 500, {
      error: 'Failed to summarize',
      details: String(err),
    });
  }
}
