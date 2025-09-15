import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

function escapeXml(unsafe = '') {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

router.get('/', async (req, res, next) => {
  try {
    const q = req.query || {};
    const title = (q.title || 'Blog Post').toString();
    const subtitle = (q.subtitle || '').toString();
    const theme = (q.theme || 'dark').toString();

    const w = Math.max(320, parseInt(q.w || q.width || '1200', 10) || 1200);
    const h = Math.max(180, parseInt(q.h || q.height || '630', 10) || 630);

    const bg = (q.bg || (theme === 'light' ? '#ffffff' : '#0b1220')).toString();
    const fg = (q.fg || (theme === 'light' ? '#111111' : '#ffffff')).toString();

    const safeTitle = escapeXml(title).slice(0, 140);
    const safeSubtitle = escapeXml(subtitle).slice(0, 200);

    const site = config.siteBaseUrl || '';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}" stop-opacity="1" />
      <stop offset="100%" stop-color="${bg}" stop-opacity="0.88" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <g transform="translate(64, 64)">
    <rect x="-16" y="-16" width="32" height="32" rx="4" fill="${fg}" opacity="0.12" />
    <text x="0" y="0" fill="${fg}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'" font-size="56" font-weight="700" dominant-baseline="hanging">
      ${safeTitle}
    </text>
    ${safeSubtitle ? `<text x="0" y="88" fill="${fg}" opacity="0.8" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial" font-size="28" font-weight="500" dominant-baseline="hanging">${safeSubtitle}</text>` : ''}
  </g>
  <text x="${w - 64}" y="${h - 48}" text-anchor="end" fill="${fg}" opacity="0.6" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial" font-size="22">${escapeXml(site)}</text>
</svg>`;

    res.status(200);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end(svg);
  } catch (err) {
    return next(err);
  }
});

export default router;
