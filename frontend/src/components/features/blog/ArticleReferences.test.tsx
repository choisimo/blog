import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { ArticleReferences } from './ArticleReferences';
import { getMarkdownSanitizeSchema } from './markdownSanitizeSchema';
import { rehypeArticleReferences } from '@/utils/content/articleReferences';

function renderArticle(content: string) {
  return render(
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeSanitize, getMarkdownSanitizeSchema('article')],
        rehypeArticleReferences,
      ]}
      components={{ details: ArticleReferences }}
    >
      {content}
    </ReactMarkdown>
  );
}

describe('article references', () => {
  it('collapses only the final bibliography and preserves its heading, text and safe links', () => {
    const { container } = renderArticle(
      '## 본문\n\n읽을 내용\n\n## 출처\n\n[01] [논문](https://example.org/paper) — 전체 서지 정보\n\n[02] [bad](javascript:alert(1))'
    );
    const panel = container.querySelector<HTMLDetailsElement>(
      'details.article-references'
    )!;
    expect(panel).not.toHaveAttribute('open');
    expect(screen.getByRole('heading', { name: '출처' })).toBeVisible();
    expect(panel.textContent).toContain('전체 서지 정보');
    expect(panel.querySelector('a')).toHaveAttribute(
      'href',
      'https://example.org/paper'
    );
    expect(panel.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(screen.getByText('읽을 내용').closest('details')).toBeNull();
  });

  it('leaves ordinary sections and references followed by more article content expanded', () => {
    const { container } = renderArticle(
      '## 참고 자료\n\n[자료](https://example.org)\n\n## 자료를 활용하는 방법\n\n여기는 본문입니다.'
    );
    expect(container.querySelector('details')).toBeNull();
    expect(screen.getByText('여기는 본문입니다.')).toBeVisible();
  });

  it('keeps GFM footnote targets and backlinks inside their own disclosure', () => {
    const { container } = renderArticle(
      '문장[^1]\n\n[^1]: 원문 [링크](https://example.org/source)'
    );
    const panel = container.querySelector(
      'section[data-footnotes] details.article-references'
    );
    expect(panel).not.toBeNull();
    const reference = container.querySelector('a[data-footnote-ref]')!;
    const target = container.querySelector(reference.getAttribute('href')!);
    expect(panel?.contains(target)).toBe(true);
    const backlink = panel?.querySelector('a[data-footnote-backref]');
    expect(container.querySelector(backlink!.getAttribute('href')!)).toBe(
      reference
    );
    expect(panel?.querySelector('summary')).toHaveAttribute(
      'id',
      'user-content-footnote-label'
    );
  });

  it('expands references for print and restores both previously closed and open states', () => {
    const { container, unmount } = renderArticle(
      '## References\n\n[Source](https://example.org)'
    );
    const panel = container.querySelector<HTMLDetailsElement>('details')!;
    fireEvent(window, new Event('beforeprint'));
    fireEvent(window, new Event('beforeprint'));
    expect(panel.open).toBe(true);
    fireEvent(window, new Event('afterprint'));
    expect(panel.open).toBe(false);
    panel.open = true;
    fireEvent(window, new Event('beforeprint'));
    fireEvent(window, new Event('afterprint'));
    expect(panel.open).toBe(true);
    unmount();
    fireEvent(window, new Event('beforeprint'));
    expect(panel.open).toBe(true);
  });

  it('preserves authored details IDs and avoids nesting another reference disclosure', () => {
    const { container } = renderArticle(
      '## 출처\n\n<details id="sources"><summary>원문 목록</summary><p>자료</p></details>'
    );
    expect(container.querySelectorAll('details')).toHaveLength(1);
    expect(container.querySelector('details')).toHaveAttribute(
      'id',
      'user-content-sources'
    );
    expect(container.querySelector('details.article-references')).toBeNull();
  });
});
