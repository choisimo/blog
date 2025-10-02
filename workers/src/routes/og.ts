import { Hono } from 'hono';
import type { Env } from '../types';

const og = new Hono<{ Bindings: Env }>();

function escapeXml(unsafe = ''): string {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// GET /og - Generate OG image (SVG)
og.get('/', async (c) => {
  const { title, subtitle, theme, w, h, bg, fg } = c.req.query();

  const width = Math.max(320, parseInt(w || '1200', 10) || 1200);
  const height = Math.max(180, parseInt(h || '630', 10) || 630);

  const isDark = theme !== 'light';
  const background = bg || (isDark ? '#0b1220' : '#ffffff');
  const foreground = fg || (isDark ? '#ffffff' : '#111111');

  const safeTitle = escapeXml(title || 'Blog Post').slice(0, 140);
  const safeSubtitle = escapeXml(subtitle || '').slice(0, 200);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${background}" stop-opacity="1" />
      <stop offset="100%" stop-color="${background}" stop-opacity="0.88" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <g transform="translate(64, 64)">
    <rect x="-16" y="-16" width="32" height="32" rx="4" fill="${foreground}" opacity="0.12" />
    <text x="0" y="0" fill="${foreground}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial" font-size="56" font-weight="700" dominant-baseline="hanging">
      ${safeTitle}
    </text>
    ${safeSubtitle ? `<text x="0" y="88" fill="${foreground}" opacity="0.8" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial" font-size="28" font-weight="500" dominant-baseline="hanging">${safeSubtitle}</text>` : ''}
  </g>
  <text x="${width - 64}" y="${height - 48}" text-anchor="end" fill="${foreground}" opacity="0.6" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial" font-size="22">blog.nodove.com</text>
</svg>`;

  c.header('Content-Type', 'image/svg+xml');
  c.header('Cache-Control', 'public, max-age=86400'); // 24 hours
  return c.body(svg);
});

export default og;
