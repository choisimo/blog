import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeChatTaskMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/chat', () => ({
  invokeChatTask: invokeChatTaskMock,
}));

vi.mock('@/services/session/userContentAuth', () => ({
  getPrincipalToken: vi.fn(),
  refreshPrincipalTokenAfterAuthFailure: vi.fn(),
}));

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.example.test',
}));

import { quiz, summary } from '@/services/discovery/ai';

describe('discovery ai service', () => {
  beforeEach(() => {
    invokeChatTaskMock.mockReset();
  });

  it('normalizes quiz question, answer, option, explanation, and tag text controls', async () => {
    invokeChatTaskMock.mockResolvedValue({
      data: {
        quiz: [
          {
            type: 'multiple-choice',
            question: ' Question\u0000\none ',
            answer: ' A\u0000 ',
            options: [' A\u0000 ', ' B\nvalue '],
            explanation: ' Because\u0000\nthis ',
            visualization: {
              html: '<div>\u0000\r\nok</div>',
              title: ' Chart\u0000 title ',
            },
          },
        ],
      },
    });

    await expect(
      quiz({
        paragraph: 'body',
        quizCount: 1,
        postTags: [' Tag\u0000\nOne '],
      }),
    ).resolves.toEqual({
      quiz: [
        {
          type: 'multiple_choice',
          question: expect.stringContaining('Question one'),
          answer: 'A',
          options: ['A', 'B value'],
          correctOptionIndex: 0,
          explanation: 'Because this',
        },
      ],
    });

    expect(invokeChatTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          postTags: ['tag one'],
        }),
      }),
    );
  });

  it('normalizes fallback summary text when AI calls fail', async () => {
    invokeChatTaskMock.mockRejectedValue(new Error('down'));

    await expect(summary({ paragraph: ' Hello\u0000\r\nworld ' })).resolves.toMatchObject({
      summary: 'Hello \nworld',
    });
  });
});
