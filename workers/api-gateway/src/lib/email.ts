import type { Env } from '../types';

export type NewPostPayload = {
  title: string;
  url?: string;
  excerpt?: string;
  tags?: string[];
  publishedAt?: string;
};

function buildEmailContent(payload: NewPostPayload, siteUrl: string) {
  const url = payload.url || `${siteUrl}/blog`;
  const safeExcerpt = (payload.excerpt || '').slice(0, 300);
  const tags = (payload.tags || []).join(', ');
  const publishedAt = payload.publishedAt || new Date().toISOString();

  const text = [
    `New post published: ${payload.title}`,
    '',
    safeExcerpt ? safeExcerpt : '',
    tags ? `Tags: ${tags}` : '',
    `Published at: ${publishedAt}`,
    `Read: ${url}`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">New post published: ${escapeHtml(payload.title)}</h2>
      ${safeExcerpt ? `<p style="margin: 0 0 12px; color: #334155;">${escapeHtml(safeExcerpt)}</p>` : ''}
      ${tags ? `<p style="margin: 0 0 12px; color: #64748b;"><strong>Tags:</strong> ${escapeHtml(tags)}</p>` : ''}
      <p style="margin: 0 0 16px; color: #64748b;"><strong>Published at:</strong> ${escapeHtml(publishedAt)}</p>
      <p style="margin: 0 0 16px;"><a href="${url}" style="background:#0ea5e9;color:white;padding:10px 14px;border-radius:8px;text-decoration:none;">Read the post</a></p>
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">This is an automated notification.</p>
    </div>
  `;

  return { text, html, url };
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendNewPostNotification(env: Env, payload: NewPostPayload) {
  // Only send in production
  if (env.ENV !== 'production') {
    return { ok: true, skipped: true, reason: 'non-production env' };
  }

  const apiKey = env.RESEND_API_KEY;
  const from = env.NOTIFY_FROM_EMAIL;
  const toList = (env.NOTIFY_TO_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const siteUrl = env.PUBLIC_SITE_URL;

  if (!apiKey || !from || !toList.length || !siteUrl) {
    return { ok: false, error: 'Missing email configuration (RESEND_API_KEY, NOTIFY_FROM_EMAIL, NOTIFY_TO_EMAILS, PUBLIC_SITE_URL)' };
  }

  const { text, html } = buildEmailContent(payload, siteUrl);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: toList,
      subject: `New post: ${payload.title}`,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: `Resend API error: ${res.status} ${err}` };
  }

  const data = await res.json().catch(() => ({}));
  return { ok: true, data };
}
