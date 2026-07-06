import { describe, expect, it } from 'vitest';
import { blogMarkdownSanitizeSchema } from '@/components/features/blog/markdownSanitizeSchema';

describe('blogMarkdownSanitizeSchema', () => {
  it('narrows markdown link protocols to browser-safe navigable schemes', () => {
    expect(blogMarkdownSanitizeSchema.protocols.href).toEqual([
      'http',
      'https',
      'mailto',
    ]);
  });

  it('keeps media URL protocols explicit for src and poster attributes', () => {
    expect(blogMarkdownSanitizeSchema.protocols.src).toEqual([
      'http',
      'https',
    ]);
    expect(blogMarkdownSanitizeSchema.protocols.poster).toEqual([
      'http',
      'https',
    ]);
  });
});
