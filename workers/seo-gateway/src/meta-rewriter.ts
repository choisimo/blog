import type { PostMeta, Env } from './types';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// This Worker owns title, description, canonical, OG/Twitter and article tags.
// Remove all prior instances, including alternate attribute casing. Other head
// elements (scripts, CSS, verification, CSP, JSON-LD) remain owned by the origin.
export class MetaTagRemover implements HTMLRewriterElementContentHandlers {
  constructor(private readonly noIndex = false) {}

  element(element: Element) {
    const tag = element.tagName.toLowerCase();
    const property = (element.getAttribute('property') || '').toLowerCase();
    const name = (element.getAttribute('name') || '').toLowerCase();
    const rel = (element.getAttribute('rel') || '').toLowerCase().split(/\s+/);
    if (tag === 'title' || (tag === 'link' && rel.includes('canonical'))) {
      element.remove();
    } else if (tag === 'meta' && (
      name === 'description' || property === 'description' ||
      /^(og:|article:|twitter:)/.test(property) || /^(og:|article:|twitter:)/.test(name) ||
      (this.noIndex && ['robots', 'googlebot', 'bingbot'].includes(name))
    )) {
      element.remove();
    }
  }
}

export class HeadEndInjector implements HTMLRewriterElementContentHandlers {
  private inserted = false;
  constructor(private readonly meta: PostMeta, private readonly siteName: string) {}

  element(element: Element) {
    if (this.inserted) return;
    this.inserted = true;
    element.append(this.generateMetaTags(), { html: true });
  }

  private generateMetaTags(): string {
    const m = this.meta;
    const title = escapeHtml(m.title);
    const description = escapeHtml(m.description);
    const image = escapeHtml(m.ogImage);
    const url = escapeHtml(m.url);
    const tags = [
      `<title>${title}</title>`,
      `<meta name="description" content="${description}" />`,
      `<link rel="canonical" href="${url}" />`,
      `<meta property="og:type" content="${m.type}" />`,
      `<meta property="og:url" content="${url}" />`,
      `<meta property="og:title" content="${title}" />`,
      `<meta property="og:description" content="${description}" />`,
      `<meta property="og:image" content="${image}" />`,
      `<meta property="og:site_name" content="${escapeHtml(this.siteName)}" />`,
      '<meta property="og:locale" content="ko_KR" />',
      '<meta name="twitter:card" content="summary_large_image" />',
      `<meta name="twitter:title" content="${title}" />`,
      `<meta name="twitter:description" content="${description}" />`,
      `<meta name="twitter:image" content="${image}" />`,
    ];
    if (m.ogImageWidth && m.ogImageHeight) {
      tags.push(`<meta property="og:image:width" content="${m.ogImageWidth}" />`,
        `<meta property="og:image:height" content="${m.ogImageHeight}" />`);
    }
    if (m.noIndex) tags.push('<meta name="robots" content="noindex, nofollow" />');
    if (m.type === 'article') {
      if (m.publishedTime) tags.push(`<meta property="article:published_time" content="${escapeHtml(m.publishedTime)}" />`);
      if (m.author) tags.push(`<meta property="article:author" content="${escapeHtml(m.author)}" />`);
      if (m.category) tags.push(`<meta property="article:section" content="${escapeHtml(m.category)}" />`);
      for (const tag of new Set(m.tags || [])) {
        tags.push(`<meta property="article:tag" content="${escapeHtml(tag)}" />`);
      }
    }
    return `\n${tags.join('\n')}\n`;
  }
}

export function createRewriter(meta: PostMeta, env: Env): HTMLRewriter {
  const remover = new MetaTagRemover(Boolean(meta.noIndex));
  return new HTMLRewriter()
    .on('head title', remover)
    .on('head meta', remover)
    .on('head link', remover)
    .on('head', new HeadEndInjector(meta, env.SITE_NAME));
}
