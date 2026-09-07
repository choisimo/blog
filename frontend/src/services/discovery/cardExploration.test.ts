import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn(), stream: vi.fn() }));
vi.mock('@/services/chat', () => ({
  createBackendSession: mocks.create,
  streamChatEvents: mocks.stream,
}));
import {
  buildCardExplorationPrompt,
  parseExplorationText,
  streamCardExploration,
  type CardExplorationInput,
} from './cardExploration';

const input = (): CardExplorationInput => ({
  seed: {
    id: 'one',
    title: 'Current card',
    body: 'Original explanation',
    persona: 'analyst',
  },
  paragraph: 'Selected paragraph',
  postTitle: 'Article',
  question: 'What are the tradeoffs?',
  history: [],
  enableRag: true,
  signal: new AbortController().signal,
});

describe('card exploration stream', () => {
  it('renders partial text while hiding a trailer split at every possible boundary', () => {
    const marker = '<<<FOLLOWUPS>>>';
    for (let length = 1; length <= marker.length; length++) {
      expect(
        parseExplorationText(`New answer\n${  marker.slice(0, length)}`)
      ).toEqual({ body: 'New answer', questions: [] });
    }
    expect(
      parseExplorationText(
        'New answer\n<<<FOLLOWUPS>>>\n["Why?", "How?", "Why?"]'
      )
    ).toEqual({ body: 'New answer', questions: ['Why?', 'How?'] });
    expect(parseExplorationText('New answer\n<<<FOLLOWUPS>>>\n["Why')).toEqual({
      body: 'New answer',
      questions: [],
    });
  });

  it('streams the same card context through an isolated authenticated chat session', async () => {
    mocks.create.mockResolvedValue('isolated-one');
    mocks.stream.mockImplementation(async function* () {
      yield { type: 'text', text: 'First part' };
      yield { type: 'text', text: ' and more\n<<<FOLLOW' };
      yield { type: 'text', text: 'UPS>>>\n["What next?"]' };
      yield { type: 'done' };
    });
    const request = input();
    const frames = [];
    for await (const frame of streamCardExploration(request))
      frames.push(frame);
    expect(frames[0].body).toBe('First part');
    expect(frames[1].body).toBe('First part and more');
    expect(frames.at(-1)).toEqual({
      body: 'First part and more',
      questions: ['What next?'],
    });
    expect(mocks.create).toHaveBeenCalledWith('문단 카드 깊이 탐구', {
      signal: request.signal,
    });
    expect(mocks.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'isolated-one',
        useArticleContext: false,
        signal: request.signal,
        enableRag: true,
      })
    );
    expect(mocks.stream.mock.calls.at(-1)?.[0].text).toContain(
      'Selected paragraph'
    );
  });

  it('bounds history without losing the chosen direction', () => {
    const request = input();
    request.paragraph = '\\'.repeat(10000);
    request.seed.body = '"'.repeat(10000);
    request.history = Array.from({ length: 15 }, (_, i) => ({
      question: `question-${i}`,
      body: '\\'.repeat(10000),
      questions: [],
    }));
    const prompt = buildCardExplorationPrompt(request);
    expect(prompt.length).toBeLessThanOrEqual(20000);
    expect(prompt).not.toContain('question-0');
    expect(prompt).toContain('question-14');
    expect(prompt).toContain(request.question);
  });

  it('rejects empty responses instead of pretending the card was updated', async () => {
    mocks.create.mockResolvedValue('isolated-one');
    mocks.stream.mockImplementation(async function* () {
      yield { type: 'done' };
    });
    await expect(
      (async () => {
        for await (const frame of streamCardExploration(input())) void frame;
      })()
    ).rejects.toThrow('응답이 비어');
  });
});
