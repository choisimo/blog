import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { queryOne, queryAll, execute } from '../lib/d1';
import { success, error } from '../lib/response';

const app = new Hono<HonoEnv>();

interface Subscriber {
  id: number;
  email: string;
  name: string | null;
  status: 'pending' | 'confirmed' | 'unsubscribed';
  confirm_token: string | null;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

type EmailResult =
  | { ok: true }
  | { ok: false; reason: 'missing_config' | 'resend_error' | 'network_error'; detail?: string };

async function sendConfirmationEmail(
  env: { RESEND_API_KEY?: string; NOTIFY_FROM_EMAIL?: string; PUBLIC_SITE_URL?: string },
  email: string,
  token: string
): Promise<EmailResult> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.NOTIFY_FROM_EMAIL;
  const siteUrl = env.PUBLIC_SITE_URL || 'https://noblog.nodove.com';
  const confirmUrl = `${siteUrl}/api/v1/subscribe/confirm?token=${token}`;
  const unsubscribeUrl = `${siteUrl}/api/v1/subscribe/unsubscribe?token=${token}`;

  if (!apiKey || !from) {
    console.error(
      '[Subscribe] Email configuration missing — cannot send confirmation email.',
      `RESEND_API_KEY: ${apiKey ? 'set' : 'MISSING'}, NOTIFY_FROM_EMAIL: ${from ? 'set' : 'MISSING'}.`,
      'Run: wrangler secret put RESEND_API_KEY && wrangler secret put NOTIFY_FROM_EMAIL'
    );
    return { ok: false, reason: 'missing_config' };
  }

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 600px; margin: 0 auto;">
      <h2 style="margin: 0 0 16px; color: #0f172a;">Nodove Blog 구독 확인</h2>
      <p style="margin: 0 0 16px; color: #334155;">구독해 주셔서 감사합니다! 아래 버튼을 클릭하여 이메일 주소를 확인해 주세요.</p>
      <p style="margin: 0 0 24px;">
        <a href="${confirmUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">구독 확인하기</a>
      </p>
      <p style="margin: 0; color: #64748b; font-size: 14px;">버튼이 작동하지 않으면 다음 링크를 복사하여 브라우저에 붙여넣으세요:<br/><a href="${confirmUrl}" style="color: #0ea5e9;">${confirmUrl}</a></p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e2e8f0;" />
      <p style="margin: 0 0 8px; color: #94a3b8; font-size: 12px;">이 이메일은 Nodove Blog 구독 요청에 의해 발송되었습니다.</p>
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">구독을 원하지 않으면 언제든지 <a href="${unsubscribeUrl}" style="color: #0ea5e9;">여기서 구독을 해지</a>할 수 있습니다.</p>
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
        from,
        to: [email],
        subject: '[Nodove Blog] 구독 확인',
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('[Subscribe] Resend API error:', res.status, detail);
      return { ok: false, reason: 'resend_error', detail: `HTTP ${res.status}: ${detail.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[Subscribe] Network error sending confirmation email:', detail);
    return { ok: false, reason: 'network_error', detail };
  }
}

app.post('/', async (c) => {
  try {
    const body = await c.req.json<{ email: string; name?: string }>();
    const { email, name } = body;

    if (!email || !email.includes('@')) {
      return error(c, 'Valid email is required', 400);
    }

    if (containsHtml(email) || (name && containsHtml(name))) {
      return error(c, 'Invalid input', 400);
    }

    const db = c.env.DB;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await queryOne<Subscriber>(
      db,
      `SELECT * FROM subscribers WHERE email = ?`,
      normalizedEmail
    );

    if (existing) {
      if (existing.status === 'confirmed') {
        return success(c, { message: 'Already subscribed', alreadySubscribed: true });
      }
      if (existing.status === 'pending') {
        const token = generateToken();
        await execute(
          db,
          `UPDATE subscribers SET confirm_token = ?, updated_at = datetime('now') WHERE id = ?`,
          token,
          existing.id
        );
        const emailResult = await sendConfirmationEmail(c.env, normalizedEmail, token);
        if (!emailResult.ok) {
          console.error('[Subscribe] Resend confirmation email failed:', emailResult.reason, emailResult.detail ?? '');
        }
        return success(c, { message: 'Confirmation email resent', pendingConfirmation: true, emailFailed: !emailResult.ok });
      }
      if (existing.status === 'unsubscribed') {
        const token = generateToken();
        await execute(
          db,
          `UPDATE subscribers SET status = 'pending', confirm_token = ?, unsubscribed_at = NULL, updated_at = datetime('now') WHERE id = ?`,
          token,
          existing.id
        );
        const emailResult = await sendConfirmationEmail(c.env, normalizedEmail, token);
        if (!emailResult.ok) {
          console.error('[Subscribe] Resubscription email failed:', emailResult.reason, emailResult.detail ?? '');
        }
        return success(c, { message: 'Resubscription confirmation sent', pendingConfirmation: true, emailFailed: !emailResult.ok });
      }
    }

    const token = generateToken();
    await execute(
      db,
      `INSERT INTO subscribers (email, name, status, confirm_token) VALUES (?, ?, 'pending', ?)`,
      normalizedEmail,
      name || null,
      token
    );

    const emailResult = await sendConfirmationEmail(c.env, normalizedEmail, token);
    if (!emailResult.ok) {
      console.error('[Subscribe] New subscription email failed:', emailResult.reason, emailResult.detail ?? '');
    }

    return success(c, { message: 'Confirmation email sent', pendingConfirmation: true, emailFailed: !emailResult.ok });
  } catch (err) {
    console.error('[Subscribe] Error:', err);
    return error(c, 'Failed to process subscription', 500);
  }
});

app.get('/confirm', async (c) => {
  try {
    const token = c.req.query('token');
    if (!token) {
      return c.redirect('/?subscribe=error&reason=missing_token');
    }

    const db = c.env.DB;
    const subscriber = await queryOne<Subscriber>(
      db,
      `SELECT * FROM subscribers WHERE confirm_token = ?`,
      token
    );

    if (!subscriber) {
      return c.redirect('/?subscribe=error&reason=invalid_token');
    }

    if (subscriber.status === 'confirmed') {
      return c.redirect('/?subscribe=already_confirmed');
    }

    await execute(
      db,
      `UPDATE subscribers SET status = 'confirmed', confirmed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      subscriber.id
    );

    return c.redirect('/?subscribe=success');
  } catch (err) {
    console.error('[Subscribe] Confirm error:', err);
    return c.redirect('/?subscribe=error&reason=server_error');
  }
});

app.get('/unsubscribe', async (c) => {
  try {
    const token = c.req.query('token');

    if (!token) {
      return c.redirect('/?unsubscribe=error&reason=missing_token');
    }

    const db = c.env.DB;
    const subscriber = await queryOne<Subscriber>(
      db,
      `SELECT * FROM subscribers WHERE confirm_token = ?`,
      token
    );

    if (!subscriber) {
      return c.redirect('/?unsubscribe=error&reason=not_found');
    }

    await execute(
      db,
      `UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      subscriber.id
    );

    return c.redirect('/?unsubscribe=success');
  } catch (err) {
    console.error('[Subscribe] Unsubscribe error:', err);
    return c.redirect('/?unsubscribe=error&reason=server_error');
  }
});

app.get('/count', async (c) => {
  try {
    const db = c.env.DB;
    const result = await queryOne<{ count: number }>(
      db,
      `SELECT COUNT(*) as count FROM subscribers WHERE status = 'confirmed'`
    );
    return success(c, { count: result?.count || 0 });
  } catch (err) {
    console.error('[Subscribe] Count error:', err);
    return error(c, 'Failed to get subscriber count', 500);
  }
});


function containsHtml(str: string): boolean {
  return /<[^>]*>/.test(str);
}

export default app;
