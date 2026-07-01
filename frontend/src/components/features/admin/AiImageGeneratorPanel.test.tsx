import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

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
});
