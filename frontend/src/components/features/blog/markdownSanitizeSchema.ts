import { defaultSchema } from 'rehype-sanitize';

import {
  getMarkdownRenderPolicy,
  type MarkdownRenderProfileName,
} from '@/lib/markdown/markdownPolicy';

const BASE_TAG_NAMES = [...(defaultSchema.tagNames ?? [])];
const ARTICLE_EXTENSION_TAG_NAMES = [
  'video',
  'source',
  'details',
  'summary',
  'mark',
  'abbr',
  'figure',
  'figcaption',
  'picture',
] as const;

const IFRAME_TAG_NAME = 'iframe';

/**
 * Build a new schema for each profile so a caller cannot mutate the shared
 * sanitizer configuration and silently weaken another Markdown surface.
 */
export function createMarkdownSanitizeSchema(
  profile: MarkdownRenderProfileName,
) {
  const policy = getMarkdownRenderPolicy(profile);
  const preserveArticleStructure = profile === 'article' || profile === 'preview';
  const tagNames = new Set<string>(BASE_TAG_NAMES);

  if (preserveArticleStructure) {
    ARTICLE_EXTENSION_TAG_NAMES.forEach((tagName) => tagNames.add(tagName));
    // Preview keeps the element long enough to render a non-loading placeholder.
    tagNames.add(IFRAME_TAG_NAME);
  }

  if (!policy.allowImages) {
    tagNames.delete('img');
    tagNames.delete('picture');
  }
  if (!policy.allowVideo) {
    tagNames.delete('video');
    tagNames.delete('source');
  }

  return {
    ...defaultSchema,
    protocols: {
      ...(defaultSchema.protocols ?? {}),
      href: ['http', 'https', 'mailto'],
      src: ['http', 'https'],
      poster: ['http', 'https'],
    },
    attributes: {
      ...defaultSchema.attributes,
      '*': [
        ...(defaultSchema.attributes?.['*'] ?? []),
        'className',
        'id',
      ],
      img: [
        ...(defaultSchema.attributes?.img ?? []),
        'src',
        'alt',
        'title',
        'width',
        'height',
        'loading',
      ],
      a: [
        ...(defaultSchema.attributes?.a ?? []),
        'href',
        'title',
        'target',
        'rel',
      ],
      video: [
        'src',
        'controls',
        'width',
        'height',
        'poster',
        'preload',
        'muted',
        'autoPlay',
        'loop',
        'playsInline',
      ],
      source: ['src', 'type'],
      iframe: [
        'src',
        'title',
        'width',
        'height',
        'loading',
        'allow',
        'allowFullScreen',
        'sandbox',
        'referrerPolicy',
      ],
      div: [...(defaultSchema.attributes?.div ?? []), 'className'],
      span: [...(defaultSchema.attributes?.span ?? []), 'className'],
      code: ['className'],
      pre: ['className'],
    },
    tagNames: [...tagNames],
  };
}

export function getMarkdownSanitizeSchema(
  profile: Extract<MarkdownRenderProfileName, 'article' | 'preview'>,
) {
  return createMarkdownSanitizeSchema(profile);
}

// Compatibility export retained for existing imports outside this scoped source.
export const blogMarkdownSanitizeSchema =
  createMarkdownSanitizeSchema('article');
export const previewMarkdownSanitizeSchema =
  createMarkdownSanitizeSchema('preview');
