import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGeneratePostImages = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());

vi.mock('@/services/session/adminImages', () => ({
  generatePostImages: mockGeneratePostImages,
}));

vi.mock('@/hooks/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

import AiImageGeneratorPanel from './AiImageGeneratorPanel';

describe('AiImageGeneratorPanel', () => {
  beforeEach(() => {
    mockGeneratePostImages.mockReset();
    mockToast.mockReset();
  });

  it('labels generated image actions by alt text', async () => {
    const user = userEvent.setup();

    mockGeneratePostImages.mockResolvedValue({
      items: [
        {
          filename: 'sample.png',
          path: '2026/sample/sample.png',
          url: '/images/2026/sample/sample.png',
          variantWebp: null,
          alt: 'Sample diagram',
          markdown: '![Sample diagram](/images/2026/sample/sample.png)',
          source: 'ai-generated',
        },
      ],
    });

    render(
      <AiImageGeneratorPanel
        title="Sample diagram"
        category="dev"
        tags="ai"
        content="content"
        year="2026"
        slug="sample"
        onInsertMarkdown={vi.fn()}
        onSetCoverImage={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '이미지 생성' }));

    expect(await screen.findByRole('button', { name: '본문에 Sample diagram 삽입' }))
      .toHaveAttribute('title', '본문에 Sample diagram 삽입');
    expect(screen.getByRole('button', { name: 'Sample diagram URL 복사' }))
      .toHaveAttribute('title', 'Sample diagram URL 복사');
    await waitFor(() => {
      expect(mockGeneratePostImages).toHaveBeenCalled();
    });
  });

  it('explains why image generation is disabled when the slug is missing', () => {
    render(
      <AiImageGeneratorPanel
        title="Sample diagram"
        category="dev"
        tags="ai"
        content="content"
        year="2026"
        slug=""
        onInsertMarkdown={vi.fn()}
        onSetCoverImage={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: '이미지 생성' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      '슬러그(slug)를 입력하면 이미지 저장 경로를 만들 수 있습니다.',
    );
    expect(
      screen.getByText(
        '슬러그(slug)를 입력하면 이미지 저장 경로를 만들 수 있습니다.',
      ),
    ).toBeInTheDocument();
  });
});
