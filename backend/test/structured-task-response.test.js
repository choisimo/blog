import test from 'node:test';
import assert from 'node:assert/strict';
import { hasStructuredResponseText } from '@blog/shared/runtime/structured-response';
import { normalizeTaskData, projectTaskDataFromText, getFallbackData } from '../src/services/quiz.service.js';

const leaked = '{"items":[{"title":"leaked"}],';
const cases = [
  ['sketch', { mood: 'curious', bullets: ['Point'] }, { mood: 'curious', bullets: [leaked] }],
  ['prism', { facets: [{ title: 'Angle', points: ['Point'] }] }, { facets: [{ title: leaked, points: ['Point'] }] }],
  ['chain', { questions: [{ q: 'Why?', why: 'Explore' }] }, { questions: [{ q: 'Why?', why: leaked }] }],
  ['summary', { summary: 'Overview', keyPoints: ['Point'] }, { summary: leaked }],
  ['quiz', { quiz: [{ type: 'explain', question: 'Why?', answer: 'Because' }] }, { quiz: [{ question: 'Why?', answer: leaked }] }],
];

for (const [mode, data, bad] of cases) {
  test(`${mode}: decode nested envelopes, validate display leaves, reject invalid projections`, () => {
    assert.deepEqual(normalizeTaskData(mode, { data: JSON.stringify({ output: { _raw: { text: JSON.stringify(data) } } }) }), data);
    assert.deepEqual(projectTaskDataFromText(mode, JSON.stringify(data)), data);
    assert.equal(normalizeTaskData(mode, bad), null);
    assert.equal(normalizeTaskData(mode, { wrongSchema: true }), null);
    assert.throws(() => projectTaskDataFromText(mode, leaked), /Invalid structured/);
    assert.throws(() => projectTaskDataFromText(mode, JSON.stringify(bad)), /Invalid structured/);
    assert.throws(() => projectTaskDataFromText(mode, '{"data":{"summary":"nested"}'), /Invalid structured/);
    assert.equal(hasStructuredResponseText(getFallbackData(mode, { paragraph: leaked })), false);
  });
}

test('deterministic control-character and trailing-comma repair precedes projection', () => {
  assert.deepEqual(projectTaskDataFromText('summary', '```json\n{"summary":"First\nSecond",}\n```'), { summary: 'First\nSecond' });
});

test('genuine prose can still be projected and quiz code remains intact', () => {
  assert.deepEqual(projectTaskDataFromText('summary', 'A useful overview.'), { summary: 'A useful overview.' });
  assert.deepEqual(projectTaskDataFromText('sketch', 'One idea.\nAnother idea.').bullets, ['One idea.', 'Another idea.']);
  assert.equal(normalizeTaskData('quiz', { quiz: [{ question: '```js\nconst n = 1;\n```', answer: 'A declaration' }] }).quiz.length, 1);
});

test('quiz rejects a poisoned option without changing the correct option index', () => {
  assert.equal(normalizeTaskData('quiz', { quiz: [{ question: 'Choose', answer: 'B', options: [leaked, 'B'], correctOptionIndex: 1 }] }), null);
});

test('cyclic and deeply nested envelopes fail safely', () => {
  const cycle = {};
  cycle.data = cycle;
  assert.equal(normalizeTaskData('summary', cycle), null);
  assert.equal(normalizeTaskData('quiz', cycle), null);
});


test('nested fallback quiz envelopes cannot be promoted to successful task results', () => {
  assert.equal(normalizeTaskData('quiz', { data: { source: 'fallback', quiz: [{ question: 'Why?', answer: 'Because' }] } }), null);
  assert.throws(() => projectTaskDataFromText('summary', ''), /Empty task response/);
});


test('keeps genuine task prose containing a JSON code example', () => {
  const prose = 'Use {"name":"Alice"} as an example.';
  assert.equal(projectTaskDataFromText('summary', prose).summary, prose);
});

test('keeps Markdown links and inline code in task prose', () => {
  for (const prose of ['`JSON.parse` decodes a JSON string.', '[RFC 8259](https://example.invalid) defines JSON.']) {
    assert.equal(projectTaskDataFromText('summary', prose).summary, prose);
  }
});
