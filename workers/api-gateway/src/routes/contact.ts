import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { success, badRequest, serverError } from '../lib/response';

const app = new Hono<HonoEnv>();

interface ContactBody {
  name: string;
  email: string;
  subject: string;
  message: string;
}

app.post('/', async (c) => {
  try {
    const body = await c.req.json<ContactBody>();
    const { name, email, subject, message } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest(c, 'name is required');
    }
    if (!email || !email.includes('@')) {
      return badRequest(c, 'Valid email is required');
    }
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return badRequest(c, 'subject is required');
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return badRequest(c, 'message is required');
    }

    const apiKey = c.env.RESEND_API_KEY;
    const to = c.env.NOTIFY_FROM_EMAIL;

    if (!apiKey || !to) {
      console.error(
        '[Contact] Email configuration missing — cannot send contact message.',
        `RESEND_API_KEY: ${apiKey ? 'set' : 'MISSING'}, NOTIFY_FROM_EMAIL: ${to ? 'set' : 'MISSING'}.`,
        'Run: wrangler secret put RESEND_API_KEY && wrangler secret put NOTIFY_FROM_EMAIL'
      );
      return serverError(c, 'Email service not configured');
    }

    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 600px; margin: 0 auto;">
        <h2 style="margin: 0 0 16px; color: #0f172a;">새 문의가 도착했습니다</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 0 0 16px;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 80px;"><strong>이름</strong></td>
            <td style="padding: 8px 0; color: #0f172a;">${escapeHtml(name.trim())}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;"><strong>이메일</strong></td>
            <td style="padding: 8px 0; color: #0f172a;">${escapeHtml(email.trim())}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;"><strong>제목</strong></td>
            <td style="padding: 8px 0; color: #0f172a;">${escapeHtml(subject.trim())}</td>
          </tr>
        </table>
        <hr style="margin: 16px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <h3 style="margin: 0 0 8px; color: #334155;">메시지</h3>
        <p style="margin: 0; color: #0f172a; white-space: pre-wrap;">${escapeHtml(message.trim())}</p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">이 이메일은 Nodove Blog 문의 폼을 통해 발송되었습니다.</p>
      </div>
    `;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: to,
          to: [to],
          reply_to: email.trim(),
          subject: `[Nodove Blog 문의] ${subject.trim()}`,
          html,
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        console.error('[Contact] Resend API error:', res.status, detail);
        return serverError(c, 'Failed to send contact message');
      }

      return success(c, { message: 'Contact message sent successfully' });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('[Contact] Network error sending contact message:', detail);
      return serverError(c, 'Failed to send contact message');
    }
  } catch (err) {
    console.error('[Contact] Error:', err);
    return serverError(c, 'Failed to process contact request');
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default app;
