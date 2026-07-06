import { describe, expect, it } from 'vitest';

import {
  getCategoryCounts,
  groupPostsByCategory,
  normalizeCategoryName,
} from '@/utils/content/categoryNormalize';
import type { BlogPost } from '@/types/blog';

function post(category: unknown): BlogPost {
  return {
    id: String(category),
    title: 'Title',
    description: 'Description',
    excerpt: 'Excerpt',
    content: '',
    date: '2026-07-03',
    author: 'Admin',
    tags: [],
    category: category as string,
    slug: String(category),
    year: '2026',
    published: true,
  };
}

describe('category normalization utility', () => {
  it('normalizes blank and non-string category values to General', () => {
    expect(normalizeCategoryName('   ')).toBe('General');
    expect(normalizeCategoryName(null)).toBe('General');
    expect(normalizeCategoryName(undefined)).toBe('General');
    expect(normalizeCategoryName(123)).toBe('General');
  });

  it('returns trimmed unknown categories instead of preserving surrounding whitespace', () => {
    expect(normalizeCategoryName('  Custom Category  ')).toBe('Custom Category');
  });

  it('uses normalized category names for counts and groups', () => {
    const posts = [
      post('  AI/ML  '),
      post('   '),
      post('  Custom Category  '),
    ];

    expect(getCategoryCounts(posts)).toEqual({
      'AI & ML': 1,
      General: 1,
      'Custom Category': 1,
    });
    expect(Object.keys(groupPostsByCategory(posts))).toEqual([
      'AI & ML',
      'General',
      'Custom Category',
    ]);
  });
});
