import { describe, expect, it } from 'vitest';
import { findArticleRanges } from './articleSearch';

function prose(html: string) {
  const element = document.createElement('article');
  element.innerHTML = html;
  return element;
}

describe('searching rendered article text', () => {
  it('finds a phrase across emphasis without changing the DOM or including controls', () => {
    const root = prose('<p>지능을 <strong>조직하는</strong> 시대</p><button>지능을 조직하는 시대</button>');
    const before = root.innerHTML;
    const result = findArticleRanges(root, '지능을 조직하는 시대');
    expect(result.ranges).toHaveLength(1);
    expect(result.ranges[0].toString()).toBe('지능을 조직하는 시대');
    expect(root.innerHTML).toBe(before);
  });
  it('treats punctuation literally and preserves Unicode offsets for case-insensitive search', () => {
    const root = prose('<p>İ (*ptr) (*PTR)</p>');
    expect(findArticleRanges(root, '(*ptr)').ranges.map(range => range.toString())).toEqual(['(*ptr)', '(*PTR)']);
  });
  it('does not join separate paragraphs or return hidden tool text', () => {
    const root = prose('<p>첫 문장</p><p>다음 문장</p><span hidden>비밀</span>');
    expect(findArticleRanges(root, '문장다음').ranges).toHaveLength(0);
    expect(findArticleRanges(root, '비밀').ranges).toHaveLength(0);
  });
  it('reports a result cap and skips empty queries', () => {
    const root = prose('<p>가 가 가</p>');
    expect(findArticleRanges(root, '가', 2)).toMatchObject({ ranges: [expect.any(Range), expect.any(Range)], limited: true });
    expect(findArticleRanges(root, '   ').ranges).toHaveLength(0);
  });
  it('keeps nested list matches in reading order without joining interrupted text', () => {
    const root = prose('<ul><li>앞<ul><li>중간</li></ul>뒤</li></ul>');
    expect(findArticleRanges(root, '앞뒤').ranges).toHaveLength(0);
    expect(findArticleRanges(root, '중간').ranges[0].toString()).toBe('중간');
  });
  it('indexes collapsed reference content without matching disclosure controls', () => {
    const root = prose('<details><summary>참고 자료 펼치기</summary><p>참고 자료 원문</p></details>');
    expect(findArticleRanges(root, '참고 자료').ranges.map(range => range.toString())).toEqual(['참고 자료']);
    expect(findArticleRanges(root, '펼치기').ranges).toHaveLength(0);
    expect(root.querySelector('details')?.open).toBe(false);
  });
});
