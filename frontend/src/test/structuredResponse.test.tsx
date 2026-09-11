import { describe, expect, it } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { ReactNode } from 'react';

function renderMarkup(node: ReactNode) {
  const view = render(<ThemeProvider>{node}</ThemeProvider>);
  const html = view.container.innerHTML;
  cleanup();
  return html;
}
import { normalizeChatTaskResponse, normalizeFeedResponse, isFallbackStructuredResponse } from '@/services/structuredResponse';
import {
  isSketchResult, isPrismResult, isChainResult, isSummaryResult,
  normalizeResponse, normalizeQuizResult,
} from '@/services/discovery/ai';
import ReadingSummary from '@/components/features/sentio/ReadingSummary';
import LensCard from '@/components/features/sentio/LensCard';
import ThoughtCard from '@/components/features/sentio/ThoughtCard';
import QuizRichContent from '@/components/features/sentio/QuizRichContent';

const leaked = '{"items":[{"title":"leaked"}],';
const cases = [
  { mode: 'sketch', data: { mood: 'curious', bullets: ['A point'] }, bad: { mood: leaked, bullets: [leaked] } },
  { mode: 'prism', data: { facets: [{ title: 'Angle', points: ['A point'] }] }, bad: { facets: [{ title: 'Angle', points: [leaked] }] } },
  { mode: 'chain', data: { questions: [{ q: 'Why?', why: 'Explore' }] }, bad: { questions: [{ q: 'Why?', why: leaked }] } },
  { mode: 'summary', data: { summary: 'Overview', keyPoints: ['A point'] }, bad: { summary: 'Overview', keyPoints: [leaked] } },
];

describe('structured task and feed boundaries (real normalizers)', () => {
  it.each(cases)('recovers encoded nested $mode envelopes and rejects poisoned leaves', ({ mode, data, bad }) => {
    const response = { data: JSON.stringify({ result: { output: JSON.stringify(data) } }) };
    expect(normalizeChatTaskResponse(response, mode)).toEqual(data);
    expect(normalizeChatTaskResponse({ data: bad }, mode)).toBeNull();
    expect(normalizeChatTaskResponse({ data: { arbitrary: true } }, mode)).toBeNull();
    expect(normalizeChatTaskResponse({ ok: false, data }, mode)).toBeNull();
    expect(normalizeChatTaskResponse({ data: { _fallback: true, data } }, mode)).toBeNull();
  });

  it('discovery validators reject strings masquerading as every task display schema', () => {
    expect(isSketchResult(cases[0].bad)).toBe(false);
    expect(isPrismResult(cases[1].bad)).toBe(false);
    expect(isChainResult(cases[2].bad)).toBe(false);
    expect(isSummaryResult(cases[3].bad)).toBe(false);
    expect(normalizeResponse({ data: { _raw: { text: JSON.stringify(cases[3].data) } } }, isSummaryResult))
      .toEqual(cases[3].data);
  });

  it.each(['summary', 'body'] as const)('validates %s feed before caching, preserving warming pages', bodyKey => {
    const feed = { items: [{ title: 'Title', [bodyKey]: 'Body', bullets: ['Point'] }], exhausted: true, nextCursor: null };
    expect(normalizeFeedResponse({ data: JSON.stringify({ payload: feed }) }, bodyKey)).toEqual(feed);
    expect(normalizeFeedResponse({ items: [{ ...feed.items[0], bullets: [leaked] }] }, bodyKey)).toBeNull();
    expect(normalizeFeedResponse({ items: [{}] }, bodyKey)).toBeNull();
    expect(normalizeFeedResponse({ items: [], warming: true }, bodyKey)).toEqual({ items: [], warming: true });
  });

  it.each(['question', 'answer', 'explanation', 'options'])('rejects quiz %s JSON without shifting answer indices', field => {
    const question = { question: 'Choose A', answer: 'A', options: ['A', 'B'], correctOptionIndex: 0, explanation: 'Because' };
    expect(normalizeQuizResult({ quiz: [{ ...question, [field]: field === 'options' ? [leaked, 'B'] : leaked }] })).toBeNull();
  });

  it('recovers quiz aliases through encoded envelopes and keeps code/visualization content', () => {
    const question = { question: 'Explain this code\n```js\nconst x = { value: 1 };\n```', answer: 'It declares x.' };
    expect(normalizeQuizResult({ output: JSON.stringify({ payload: { questions: [question] } }) })?.quiz[0].question)
      .toContain('const x = { value: 1 };');
    const result = normalizeQuizResult({ quiz: [{ ...question, visualization: { html: '<div>Chart</div>' } }] });
    expect(result?.quiz[0].question).toContain('```viz');
  });

  it('rejects the production thought snapshot fragment shape', () => {
    const item = { title: '{', body: '"items": [ { "trackKey": "topic", "title": "Question" } ]' };
    expect(normalizeFeedResponse({ source: 'snapshot', items: [item] }, 'body')).toBeNull();
  });

  it('recognizes fallback markers through encoded transport envelopes', () => {
    const response = { data: JSON.stringify({ output: { source: 'fallback', data: { quiz: [{ question: 'Why?', answer: 'Because' }] } } }) };
    expect(isFallbackStructuredResponse(response)).toBe(true);
    expect(normalizeQuizResult(response)).toBeNull();
  });

  it('bounds cyclic envelopes and rejects truncated containers', () => {
    const cycle: Record<string, unknown> = {};
    cycle.data = cycle;
    expect(normalizeChatTaskResponse(cycle, 'summary')).toBeNull();
    expect(normalizeQuizResult(cycle)).toBeNull();
    expect(normalizeChatTaskResponse('{"data":{"summary":"valid nested item"}', 'summary')).toBeNull();
  });
});

describe('real rendering guards', () => {
  it('does not render leaked lens, thought, summary, or quiz text', () => {
    const lens = { id: 'one', angleKey: 'one', personaId: 'mentor' as const, title: leaked, summary: leaked, detail: leaked, bullets: [leaked], tags: [leaked] };
    const thought = { id: 'one', trackKey: 'one', title: leaked, subtitle: leaked, body: leaked, bullets: [leaked], tags: [leaked] };
    for (const node of [
      <LensCard card={lens} />, <ThoughtCard card={thought} index={0} />,
      <ReadingSummary summary={leaked} points={[leaked]} />, <QuizRichContent content={leaked} />,
    ]) {
      const html = renderMarkup(node);
      expect(html).not.toContain('leaked');
      expect(html).not.toContain('&quot;items&quot;');
    }
  });

  it('still renders ordinary summary prose and quiz code', () => {
    expect(renderMarkup(<ReadingSummary summary='A useful overview' points={['Key takeaway']} />))
      .toContain('A useful overview');
    expect(renderMarkup(<QuizRichContent content={'```js\nconst count = 1;\n```'} />))
      .toContain('count');
  });
});
