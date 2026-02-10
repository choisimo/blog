import type { PostMeta, Env } from './types';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class MetaTagRemover implements HTMLRewriterElementContentHandlers {
  element(element: Element) {
    const property = element.getAttribute('property');
    const name = element.getAttribute('name');

    if (property?.startsWith('og:') || property?.startsWith('article:')) {
      element.remove();
      return;
    }
    if (name?.startsWith('twitter:')) {
      element.remove();
      return;
    }
  }
}

export class DescriptionRewriter implements HTMLRewriterElementContentHandlers {
  private description: string;

  constructor(description: string) {
    this.description = description;
  }

  element(element: Element) {
    const name = element.getAttribute('name');
    if (name === 'description') {
      element.setAttribute('content', this.description);
    }
  }
}

export class TitleRewriter implements HTMLRewriterElementContentHandlers {
  private title: string;

  constructor(title: string) {
    this.title = title;
  }

  element(element: Element) {
    element.setInnerContent(this.title);
  }
}

export class HeadEndInjector implements HTMLRewriterElementContentHandlers {
  private meta: PostMeta;
  private siteName: string;

  constructor(meta: PostMeta, siteName: string) {
    this.meta = meta;
    this.siteName = siteName;
  }

  element(element: Element) {
    const tags = this.generateMetaTags();
    element.append(tags, { html: true });
  }

  private generateMetaTags(): string {
    const m = this.meta;
    const title = escapeHtml(m.title);
    const description = escapeHtml(m.description);
    const ogImage = escapeHtml(m.ogImage);
    const url = escapeHtml(m.url);
    const siteName = escapeHtml(this.siteName);

    let tags = `
    <meta property="og:type" content="${m.type}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="${siteName}" />
    <meta property="og:locale" content="ko_KR" />`;

    if (m.type === 'article') {
      if (m.publishedTime) {
        tags += `\n    <meta property="article:published_time" content="${escapeHtml(m.publishedTime)}" />`;
      }
      if (m.author) {
        tags += `\n    <meta property="article:author" content="${escapeHtml(m.author)}" />`;
      }
      if (m.category) {
        tags += `\n    <meta property="article:section" content="${escapeHtml(m.category)}" />`;
      }
      if (m.tags && m.tags.length > 0) {
        for (const tag of m.tags) {
          tags += `\n    <meta property="article:tag" content="${escapeHtml(tag)}" />`;
        }
      }
    }

    tags += `
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImage}" />
    <link rel="canonical" href="${url}" />
    `;

    return tags;
  }
}

export function createRewriter(meta: PostMeta, env: Env): HTMLRewriter {
  return new HTMLRewriter()
    .on('title', new TitleRewriter(meta.title))
    .on('meta[property^="og:"]', new MetaTagRemover())
    .on('meta[property^="article:"]', new MetaTagRemover())
    .on('meta[name^="twitter:"]', new MetaTagRemover())
    .on('meta[name="description"]', new DescriptionRewriter(meta.description))
    .on('head', new HeadEndInjector(meta, env.SITE_NAME));
}
