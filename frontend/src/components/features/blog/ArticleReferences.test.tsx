import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { ArticleReferences } from './ArticleReferences';
import { getMarkdownSanitizeSchema } from './markdownSanitizeSchema';
import {
  handleArticleCitationClick,
  rehypeArticleReferences,
} from '@/utils/content/articleReferences';

function renderArticle(content: string) {
  return render(
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeSanitize, getMarkdownSanitizeSchema('article')],
        rehypeArticleReferences,
      ]}
      components={{
        details: ArticleReferences,
        a: ({ node: _node, ...props }) => (
          <a {...props} onClick={handleArticleCitationClick} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

describe('article references', () => {
  afterEach(() => {
    window.history.replaceState(null, '', window.location.pathname);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('connects every citation in the revised article to its bibliography', () => {
    const markdown = readFileSync(
      'public/posts/2026/organizing-intelligence-era.md',
      'utf8'
    ).replace(/^---\n[\s\S]*?\n---\n/, '');
    const { container } = renderArticle(markdown);
    const panel = container.querySelector('details.article-references')!;
    expect(panel).not.toHaveAttribute('open');
    expect(panel.querySelectorAll('.article-reference-target')).toHaveLength(
      51
    );
    const citations = container.querySelectorAll('sup.article-citation a');
    const expected = [
      ...markdown.split('## 출처와 자료의 범위')[0].matchAll(/\[\d{2}\]/g),
    ];
    expect(citations).toHaveLength(expected.length);
    expect(citations.length).toBeGreaterThan(51);
    for (const citation of citations) {
      const target = container.querySelector(citation.getAttribute('href')!);
      expect(target?.textContent).toContain(citation.textContent);
      expect(panel.contains(target)).toBe(true);
    }
  });

  it('leaves unmatched numbers, code, existing links and bibliography text intact', () => {
    const { container } = renderArticle(
      '문장[01][02][99] `array[01]` [[01]](https://example.org)\n\n```text\narray[01]\n```\n\n## 출처와 자료의 범위\n\n**[01] 첫 자료.** [원문](https://example.org/one)\n\n[02] 둘째 자료.'
    );
    expect(container.querySelectorAll('sup.article-citation')).toHaveLength(2);
    expect(
      container.querySelectorAll('code sup, a a, details sup')
    ).toHaveLength(0);
    expect(container.querySelector('a[href="https://example.org"]')).toHaveTextContent('[01]');
    expect(container.textContent).toContain('[99]');
    expect(container.querySelector('details')?.textContent).toContain(
      '[01] 첫 자료. 원문'
    );
  });

  it.each([false, true])(
    'opens and focuses a citation repeatedly (reduced motion: %s)',
    reducedMotion => {
      const scrollIntoView = vi.fn();
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: reducedMotion,
        media: query,
      }));
      const { container } = renderArticle('문장[01]\n\n## 출처\n\n[01] 자료');
      const citation = container.querySelector<HTMLAnchorElement>('sup a')!;
      const target = container.querySelector<HTMLElement>(
        citation.getAttribute('href')!
      )!;
      target.scrollIntoView = scrollIntoView;
      const panel = container.querySelector<HTMLDetailsElement>('details')!;
      for (let attempt = 0; attempt < 2; attempt++) {
        panel.open = false;
        fireEvent.click(citation);
        expect(panel.open).toBe(true);
        expect(target).toHaveFocus();
        expect(window.location.hash).toBe(citation.getAttribute('href'));
      }
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
      expect(scrollIntoView).toHaveBeenLastCalledWith({
        block: 'center',
        behavior: reducedMotion ? 'instant' : 'smooth',
      });
    }
  );

  it('reveals a linked source on hash navigation and leaves modified clicks native', () => {
    const { container } = renderArticle('문장[01]\n\n## 출처\n\n[01] 자료');
    const citation = container.querySelector<HTMLAnchorElement>('sup a')!;
    const target = container.querySelector<HTMLElement>(
      citation.getAttribute('href')!
    )!;
    target.scrollIntoView = vi.fn();
    const panel = container.querySelector<HTMLDetailsElement>('details')!;
    fireEvent.click(citation, { ctrlKey: true });
    expect(panel.open).toBe(false);
    window.history.replaceState(null, '', citation.getAttribute('href'));
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(panel.open).toBe(true);
    expect(target.scrollIntoView).toHaveBeenCalled();
  });

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
