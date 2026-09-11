import { expect, it } from 'vitest';
import { buildCardExplorationPrompt } from '@/services/discovery/cardExploration';

it('requests a separate grounded explanation for every evidence point without recycling summary or history', () => {
  const prompt = buildCardExplorationPrompt({
    purpose: 'evidence',
    seed: {
      id: 'pointer',
      title: '포인터와 메모리',
      body: '포인터는 주소를 저장합니다.',
      points: [
        '포인터 자체도 메모리에 저장된다.',
        '역참조는 저장된 주소에 접근한다.',
      ],
    },
    paragraph: 'p = &x는 x의 주소를 p에 저장한다.',
    question: '근거 분석',
    history: [],
    enableRag: true,
    signal: new AbortController().signal,
  });
  expect(prompt).toContain('포인터 자체도 메모리에 저장된다.');
  expect(prompt).toContain('역참조는 저장된 주소에 접근한다.');
  expect(prompt).toContain('모든 항목을 순서대로');
  expect(prompt).toContain('성립 조건과 한계 또는 반례');
  expect(prompt).toContain(
    '확인하지 못한 인용, URL, 수치, 연구 결과를 만들지 말고'
  );
  expect(prompt).not.toContain('<<<FOLLOWUPS>>>');
});

it('keeps JSON-escaped evidence context within the chat input limit', () => {
  const long = '\\"'.repeat(12000);
  const prompt = buildCardExplorationPrompt({
    purpose: 'evidence',
    seed: {
      id: 'long',
      title: long,
      body: long,
      persona: long,
      points: Array(8).fill(long),
    },
    paragraph: long,
    postTitle: long,
    question: long,
    history: Array.from({ length: 8 }, () => ({
      question: long,
      body: long,
      questions: [],
    })),
    enableRag: false,
    signal: new AbortController().signal,
  });
  expect(prompt.length).toBeLessThan(20000);
  expect(prompt).toContain('"number":8');
  expect(prompt).toContain('"previousSteps":[]');
});
