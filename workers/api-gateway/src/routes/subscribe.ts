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

async function sendConfirmationEmail(
  env: { RESEND_API_KEY?: string; NOTIFY_FROM_EMAIL?: string; PUBLIC_SITE_URL?: string },
  email: string,
  token: string
): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.NOTIFY_FROM_EMAIL;
  const siteUrl = env.PUBLIC_SITE_URL || 'https://noblog.nodove.com';

  if (!apiKey || !from) {
    console.warn('[Subscribe] Missing RESEND_API_KEY or NOTIFY_FROM_EMAIL');
    return false;
  }

  const confirmUrl = `${siteUrl}/api/v1/subscribe/confirm?token=${token}`;

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 600px; margin: 0 auto;">
      <h2 style="margin: 0 0 16px; color: #0f172a;">Nodove Blog 구독 확인</h2>
      <p style="margin: 0 0 16px; color: #334155;">구독해 주셔서 감사합니다! 아래 버튼을 클릭하여 이메일 주소를 확인해 주세요.</p>
      <p style="margin: 0 0 24px;">
        <a href="${confirmUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">구독 확인하기</a>
      </p>
      <p style="margin: 0; color: #64748b; font-size: 14px;">버튼이 작동하지 않으면 다음 링크를 복사하여 브라우저에 붙여넣으세요:<br/><a href="${confirmUrl}" style="color: #0ea5e9;">${confirmUrl}</a></p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e2e8f0;" />
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">이 이메일은 Nodove Blog 구독 요청에 의해 발송되었습니다.</p>
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
      const err = await res.text();
      console.error('[Subscribe] Resend API error:', res.status, err);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Subscribe] Failed to send confirmation email:', err);
    return false;
  }
}

app.post('/', async (c) => {
  try {
    const body = await c.req.json<{ email: string; name?: string }>();
    const { email, name } = body;

    if (!email || !email.includes('@')) {
      return error(c, 'Valid email is required', 400);
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
        await sendConfirmationEmail(c.env, normalizedEmail, token);
        return success(c, { message: 'Confirmation email resent', pendingConfirmation: true });
      }
      if (existing.status === 'unsubscribed') {
        const token = generateToken();
        await execute(
          db,
          `UPDATE subscribers SET status = 'pending', confirm_token = ?, unsubscribed_at = NULL, updated_at = datetime('now') WHERE id = ?`,
          token,
          existing.id
        );
        await sendConfirmationEmail(c.env, normalizedEmail, token);
        return success(c, { message: 'Resubscription confirmation sent', pendingConfirmation: true });
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

    await sendConfirmationEmail(c.env, normalizedEmail, token);

    return success(c, { message: 'Confirmation email sent', pendingConfirmation: true });
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
      `UPDATE subscribers SET status = 'confirmed', confirm_token = NULL, confirmed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
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
    const email = c.req.query('email');
    const token = c.req.query('token');

    if (!email && !token) {
      return c.redirect('/?unsubscribe=error&reason=missing_params');
    }

    const db = c.env.DB;
    let subscriber: Subscriber | null = null;

    if (token) {
      subscriber = await queryOne<Subscriber>(
        db,
        `SELECT * FROM subscribers WHERE confirm_token = ?`,
        token
      );
    } else if (email) {
      subscriber = await queryOne<Subscriber>(
        db,
        `SELECT * FROM subscribers WHERE email = ?`,
        email.toLowerCase().trim()
      );
    }

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

export async function notifySubscribersOfNewPost(
  env: { DB: D1Database; RESEND_API_KEY?: string; NOTIFY_FROM_EMAIL?: string; PUBLIC_SITE_URL?: string; ENV?: string },
  post: { title: string; slug: string; year: string; excerpt?: string; tags?: string[] }
): Promise<{ sent: number; failed: number }> {
  if (env.ENV !== 'production') {
    return { sent: 0, failed: 0 };
  }

  const apiKey = env.RESEND_API_KEY;
  const from = env.NOTIFY_FROM_EMAIL;
  const siteUrl = env.PUBLIC_SITE_URL || 'https://noblog.nodove.com';

  if (!apiKey || !from) {
    console.warn('[Subscribe] Missing email configuration');
    return { sent: 0, failed: 0 };
  }

  const subscribers = await queryAll<Subscriber>(
    env.DB,
    `SELECT * FROM subscribers WHERE status = 'confirmed'`
  );

  if (subscribers.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const postUrl = `${siteUrl}/blog/${post.year}/${post.slug}`;
  const tagsHtml = post.tags?.length
    ? `<p style="margin: 0 0 16px; color: #64748b;"><strong>Tags:</strong> ${post.tags.join(', ')}</p>`
    : '';

  let sent = 0;
  let failed = 0;

  for (const subscriber of subscribers) {
    const unsubscribeUrl = `${siteUrl}/api/v1/subscribe/unsubscribe?email=${encodeURIComponent(subscriber.email)}`;

    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 600px; margin: 0 auto;">
        <h2 style="margin: 0 0 16px;">새 글이 발행되었습니다: ${escapeHtml(post.title)}</h2>
        ${post.excerpt ? `<p style="margin: 0 0 16px; color: #334155;">${escapeHtml(post.excerpt.slice(0, 300))}</p>` : ''}
        ${tagsHtml}
        <p style="margin: 0 0 24px;">
          <a href="${postUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">글 읽기</a>
        </p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">
          이 이메일은 Nodove Blog 구독자에게 발송되었습니다.
          <a href="${unsubscribeUrl}" style="color: #94a3b8;">구독 취소</a>
        </p>
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
          to: [subscriber.email],
          subject: `[Nodove Blog] ${post.title}`,
          html,
        }),
      });

      if (res.ok) {
        sent++;
      } else {
        failed++;
        console.error(`[Subscribe] Failed to send to ${subscriber.email}:`, await res.text());
      }
    } catch (err) {
      failed++;
      console.error(`[Subscribe] Error sending to ${subscriber.email}:`, err);
    }
  }

  return { sent, failed };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default app;
