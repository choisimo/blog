export type MarkdownRenderProfileName =
  | 'article'
  | 'preview'
  | 'description'
  | 'chat'
  | 'comment';

export type MarkdownLinkMode = 'navigate' | 'inert';

export interface MarkdownRenderPolicy {
  name: MarkdownRenderProfileName;
  allowRawHtml: boolean;
  allowImages: boolean;
  allowVideo: boolean;
  allowIframe: boolean;
  allowRelativeLinks: boolean;
  allowMailto: boolean;
  linkMode: MarkdownLinkMode;
  openExternalLinksInNewWindow: boolean;
  preserveHeadingAnchors: boolean;
  preserveIncompleteMarkdown: boolean;
  hrefUnsafeInput: 'strip' | 'reject';
}

const POLICIES: Readonly<Record<MarkdownRenderProfileName, MarkdownRenderPolicy>> =
  Object.freeze({
    article: Object.freeze({
      name: 'article',
      allowRawHtml: true,
      allowImages: true,
      allowVideo: true,
      allowIframe: true,
      allowRelativeLinks: true,
      allowMailto: true,
      linkMode: 'navigate',
      openExternalLinksInNewWindow: true,
      preserveHeadingAnchors: true,
      preserveIncompleteMarkdown: true,
      hrefUnsafeInput: 'strip',
    }),
    preview: Object.freeze({
      name: 'preview',
      allowRawHtml: true,
      allowImages: true,
      allowVideo: true,
      allowIframe: false,
      allowRelativeLinks: true,
      allowMailto: true,
      linkMode: 'inert',
      openExternalLinksInNewWindow: false,
      preserveHeadingAnchors: true,
      preserveIncompleteMarkdown: true,
      hrefUnsafeInput: 'strip',
    }),
    description: Object.freeze({
      name: 'description',
      allowRawHtml: false,
      allowImages: false,
      allowVideo: false,
      allowIframe: false,
      allowRelativeLinks: false,
      allowMailto: true,
      linkMode: 'navigate',
      openExternalLinksInNewWindow: true,
      preserveHeadingAnchors: false,
      preserveIncompleteMarkdown: true,
      hrefUnsafeInput: 'strip',
    }),
    chat: Object.freeze({
      name: 'chat',
      allowRawHtml: false,
      allowImages: false,
      allowVideo: false,
      allowIframe: false,
      allowRelativeLinks: false,
      allowMailto: true,
      linkMode: 'navigate',
      openExternalLinksInNewWindow: true,
      preserveHeadingAnchors: false,
      preserveIncompleteMarkdown: true,
      hrefUnsafeInput: 'reject',
    }),
    comment: Object.freeze({
      name: 'comment',
      allowRawHtml: false,
      allowImages: false,
      allowVideo: false,
      allowIframe: false,
      allowRelativeLinks: true,
      allowMailto: true,
      linkMode: 'navigate',
      openExternalLinksInNewWindow: false,
      preserveHeadingAnchors: false,
      preserveIncompleteMarkdown: true,
      hrefUnsafeInput: 'reject',
    }),
  });

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g;
const ANSI_ESCAPE_DETECTOR =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)|[@-Z\\-_])/;
const MULTILINE_CONTROL_PATTERN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;
const CONTROL_DETECTOR = /[\u0000-\u001f\u007f-\u009f]/;
const INTERNAL_WHITESPACE_PATTERN = /\s/;
const MALFORMED_PERCENT_PATTERN = /%(?![0-9A-Fa-f]{2})/;
const ENCODED_CONTROL_PATTERN = /%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7[Ff])/;
const ENCODED_SEPARATOR_PATTERN = /%(?:2[Ff]|5[Cc])/;
const ABSOLUTE_SCHEME_PATTERN = /^([A-Za-z][A-Za-z0-9+.-]*):/;

export function getMarkdownRenderPolicy(
  name: MarkdownRenderProfileName,
): MarkdownRenderPolicy {
  return POLICIES[name];
}

/**
 * Removes terminal/control transport bytes without closing, balancing, trimming,
 * or otherwise rewriting Markdown syntax. This is safe for partial streams.
 */
export function normalizeMarkdownSource(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(/\r\n?/g, '\n')
    .replace(MULTILINE_CONTROL_PATTERN, '');
}

export function normalizeMarkdownAccessibleText(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const normalized = String(value)
    .replace(ANSI_ESCAPE_PATTERN, ' ')
    .replace(SINGLE_LINE_CONTROL_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || undefined;
}

function containsUnsafePathSegment(decodedPath: string): boolean {
  return decodedPath
    .split('/')
    .some((segment) => segment === '.' || segment === '..');
}

function prepareHref(
  value: unknown,
  policy: MarkdownRenderPolicy,
): string | null {
  if (typeof value !== 'string') return null;
  if (policy.hrefUnsafeInput === 'reject') {
    if (ANSI_ESCAPE_DETECTOR.test(value) || CONTROL_DETECTOR.test(value)) {
      return null;
    }
  }

  const normalized =
    policy.hrefUnsafeInput === 'strip'
      ? value
          .replace(ANSI_ESCAPE_PATTERN, ' ')
          .replace(SINGLE_LINE_CONTROL_PATTERN, ' ')
          .trim()
      : value.trim();

  if (
    !normalized ||
    normalized.includes('\\') ||
    INTERNAL_WHITESPACE_PATTERN.test(normalized) ||
    MALFORMED_PERCENT_PATTERN.test(normalized) ||
    ENCODED_CONTROL_PATTERN.test(normalized) ||
    ENCODED_SEPARATOR_PATTERN.test(normalized) ||
    normalized.startsWith('//')
  ) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(normalized);
  } catch {
    return null;
  }

  if (CONTROL_DETECTOR.test(decoded) || decoded.includes('\\')) return null;
  return normalized;
}

export function normalizeMarkdownHrefForProfile(
  value: unknown,
  profile: MarkdownRenderProfileName,
): string | null {
  const policy = getMarkdownRenderPolicy(profile);
  const href = prepareHref(value, policy);
  if (!href) return null;

  if (href.startsWith('#')) {
    return href.length > 1 ? href : null;
  }

  if (href.startsWith('/')) {
    const decodedPath = decodeURIComponent(href).split(/[?#]/, 1)[0] || '';
    return containsUnsafePathSegment(decodedPath) ? null : href;
  }

  const scheme = href.match(ABSOLUTE_SCHEME_PATTERN)?.[1]?.toLowerCase();
  if (scheme) {
    if (scheme === 'mailto') return policy.allowMailto ? href : null;
    if (scheme !== 'http' && scheme !== 'https') return null;

    try {
      const parsed = new URL(href);
      if (parsed.username || parsed.password) return null;
      // Article, preview and comment historically preserve the author's URL
      // spelling after validation. Chat/description keep their existing
      // canonical URL behavior. Validation and presentation stay separate.
      return profile === 'article' || profile === 'preview' || profile === 'comment'
        ? href
        : parsed.href;
    } catch {
      return null;
    }
  }

  if (!policy.allowRelativeLinks) return null;
  // Relative article/comment links historically support ./ and ../ navigation.
  // Encoded separators, controls, backslashes and protocol-relative values were
  // already rejected above, so keep the original relative spelling intact.
  return href;
}

export interface MarkdownLinkPresentation {
  href: string | null;
  interactive: boolean;
  external: boolean;
  target?: '_blank';
  rel?: 'noopener noreferrer';
}

export function getMarkdownLinkPresentation(
  value: unknown,
  profile: MarkdownRenderProfileName,
): MarkdownLinkPresentation {
  const policy = getMarkdownRenderPolicy(profile);
  const href = normalizeMarkdownHrefForProfile(value, profile);
  const external = Boolean(href && /^(?:https?:|mailto:)/i.test(href));
  const interactive = Boolean(href && policy.linkMode === 'navigate');
  const newWindow =
    interactive && external && policy.openExternalLinksInNewWindow;

  return {
    href,
    interactive,
    external,
    target: newWindow ? '_blank' : undefined,
    rel: newWindow ? 'noopener noreferrer' : undefined,
  };
}

export function resolveMarkdownMediaPath(
  value: unknown,
  postPath = '',
): string | null {
  if (typeof value !== 'string') return null;
  let raw = value.trim();
  // Keep the legacy manifest rewrite that existing article media already uses.
  // This only changes the historical /posts/<year>/images/ alias to /images/;
  // it does not resolve traversal or broaden the accepted protocols.
  if (/^\/posts\/\d{4}\/images\//i.test(raw)) {
    raw = raw.replace(/^\/posts\/\d{4}\//i, '/');
  } else if (/^posts\/\d{4}\/images\//i.test(raw)) {
    raw = raw.replace(/^posts\/\d{4}\//i, '');
  }
  if (
    !raw ||
    ANSI_ESCAPE_DETECTOR.test(raw) ||
    CONTROL_DETECTOR.test(raw) ||
    raw.includes('\\') ||
    raw.startsWith('//') ||
    MALFORMED_PERCENT_PATTERN.test(raw) ||
    ENCODED_CONTROL_PATTERN.test(raw) ||
    ENCODED_SEPARATOR_PATTERN.test(raw)
  ) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (CONTROL_DETECTOR.test(decoded) || decoded.includes('\\')) return null;

  const scheme = raw.match(ABSOLUTE_SCHEME_PATTERN)?.[1]?.toLowerCase();
  if (scheme) {
    if (scheme !== 'http' && scheme !== 'https') return null;
    try {
      const parsed = new URL(raw);
      if (parsed.username || parsed.password) return null;
      return raw;
    } catch {
      return null;
    }
  }

  const decodedPath = decoded.split(/[?#]/, 1)[0] || '';
  if (raw.startsWith('/')) {
    return containsUnsafePathSegment(decodedPath) ? null : raw;
  }

  const rootImagesMatch = raw.match(/^(?:\.\.\/|\.\/)*images\/(.+)$/i);
  if (rootImagesMatch?.[1]) {
    const relative = decodeURIComponent(rootImagesMatch[1]).split(/[?#]/, 1)[0] || '';
    return containsUnsafePathSegment(relative) ? null : `/images/${rootImagesMatch[1]}`;
  }

  const rootPostsMatch = raw.match(/^(?:\.\.\/|\.\/)*posts\/(.+)$/i);
  if (rootPostsMatch?.[1]) {
    const relative = decodeURIComponent(rootPostsMatch[1]).split(/[?#]/, 1)[0] || '';
    return containsUnsafePathSegment(relative) ? null : `/posts/${rootPostsMatch[1]}`;
  }

  const normalizedRelative = raw.replace(/^\.\//, '');
  const normalizedDecodedPath = decodeURIComponent(normalizedRelative).split(/[?#]/, 1)[0] || '';
  if (containsUnsafePathSegment(normalizedDecodedPath)) return null;
  const year = postPath.split('/')[0] ?? '';
  return /^\d{4}$/.test(year)
    ? `/posts/${year}/${normalizedRelative}`
    : `/${normalizedRelative}`;
}
