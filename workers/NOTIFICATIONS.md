# New Post Email Notifications (Resend)

This document explains how to enable server-side email notifications for new posts using Resend on Cloudflare Workers. The client never sees private email addresses or API keys. Only the Workers backend sends notifications when a post is first published.

## Overview

- Provider: Resend (https://resend.com)
- Trigger point:
  - POST /api/v1/posts – if created with status "published"
  - PUT /api/v1/posts/:slug – when transitioning from non-published to "published"
- Environment: Only sends in production (env var `ENV=production`). In development, sending is skipped.
- Secrets and vars (set via Wrangler):
  - RESEND_API_KEY: API key for Resend
  - NOTIFY_FROM_EMAIL: Verified sender (e.g., `no-reply@nodove.com`)
  - NOTIFY_TO_EMAILS: Comma-separated recipients (e.g., `owner@nodove.com,team@nodove.com`)
  - PUBLIC_SITE_URL: Public site URL (e.g., `https://blog.nodove.com`)

## Files

- workers/src/lib/email.ts – `sendNewPostNotification()` implementation
- workers/src/routes/posts.ts – calls notification on publish
- workers/src/types.ts – Env types extended for secrets/vars
- workers/wrangler.toml – documents required secrets and adds `PUBLIC_SITE_URL`
- workers/.dev.vars.example – placeholders for local dev

## Setup

1) Create a Resend API key and verify your sending domain/sender.

2) Set production secrets in Cloudflare Workers:

```bash
# from workers/ directory
npx wrangler secret put RESEND_API_KEY --env production
npx wrangler secret put NOTIFY_FROM_EMAIL --env production
npx wrangler secret put NOTIFY_TO_EMAILS --env production
```

3) Ensure production variables exist in wrangler.toml:

- [env.production.vars]
  - ENV = "production"
  - PUBLIC_SITE_URL = "https://noblog.nodove.com" (or your domain)

4) (Optional) Local dev test (sending is skipped unless ENV=production):

- Copy `.dev.vars.example` to `.dev.vars` and fill values if you want end-to-end testing.
- Note: `sendNewPostNotification` returns `{ skipped: true }` when `ENV !== 'production'`.

## How It Works

- When a post is created with `status = 'published'`, or an existing post is updated from non-published to `published`, the worker builds a minimal text/HTML email and calls Resend API.
- The email includes: title, excerpt (if any), tags, publishedAt, and a link to the post constructed from `PUBLIC_SITE_URL`.

## Security

- API keys and private emails are never exposed to the client.
- All secrets are stored in Cloudflare and referenced via bindings.
- The public-facing site email (used in `mailto:`) is configured on the frontend as `site.publicEmail`.

## Troubleshooting

- If type checks complain about Workers types, ensure dependencies are installed:

```bash
cd workers
npm ci
npm run typecheck
```

- If emails do not send in production, verify:
  - RESEND_API_KEY is valid and domain/sender is verified
  - NOTIFY_FROM_EMAIL matches a verified sender
  - NOTIFY_TO_EMAILS is a comma-separated list with valid addresses
  - PUBLIC_SITE_URL is set and correct
  - Worker is deployed with `--env production`

## Verification Checklist

- [ ] POST create published triggers notification (observe Resend dashboard)
- [ ] PUT draft->published triggers notification once
- [ ] Non-production environments do not send (skipped)
- [ ] Secrets are not logged nor exposed in responses
