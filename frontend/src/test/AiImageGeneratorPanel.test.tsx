import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AiImageGeneratorPanel from '@/components/features/admin/AiImageGeneratorPanel';

const panelMocks = vi.hoisted(() => ({
  generatePostImages: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/services/session/adminImages', () => ({
  generatePostImages: panelMocks.generatePostImages,
}));

vi.mock('@/hooks/ui/use-toast', () => ({
  useToast: () => ({ toast: panelMocks.toast }),
}));

function renderPanel() {
  const props = {
    title: 'Draft Title',
    category: 'Tech',
    tags: 'ai',
    content: 'Body',
    year: '2026',
    slug: 'draft-title',
    onInsertMarkdown: vi.fn(),
    onSetCoverImage: vi.fn(),
  };

  render(<AiImageGeneratorPanel {...props} />);
  return props;
}

describe('AiImageGeneratorPanel generated image URL boundaries', () => {
  beforeEach(() => {
    panelMocks.generatePostImages.mockReset();
    panelMocks.toast.mockReset();
  });

  it('does not render or insert unsafe generated image URLs', async () => {
    const props = renderPanel();
    panelMocks.generatePostImages.mockResolvedValue({
      items: [
        {
          path: 'unsafe',
          url: 'javascript:alert(1)',
          variantWebp: { url: 'https://user:pass@example.com/%0a.webp' },
          alt: 'Unsafe\u0000Image',
          markdown: '![unsafe](javascript:alert(1))',
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: '이미지 생성' }));

    await waitFor(() => {
      expect(panelMocks.generatePostImages).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삽입' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '커버' })).not.toBeInTheDocument();
    expect(props.onInsertMarkdown).not.toHaveBeenCalled();
    expect(props.onSetCoverImage).not.toHaveBeenCalled();
  });

  it('rebuilds inserted markdown from sanitized generated image URL and alt text', async () => {
    const props = renderPanel();
    panelMocks.generatePostImages.mockResolvedValue({
      items: [
        {
          path: 'safe',
          url: '/images/2026/draft-title/cover.png',
          alt: 'Safe\u0000Cover',
          markdown: '![unsafe](javascript:alert(1))',
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: '이미지 생성' }));

    await screen.findByRole('img', { name: 'Safe Cover' });
    fireEvent.click(screen.getByRole('button', { name: '삽입' }));

    expect(props.onInsertMarkdown).toHaveBeenCalledWith(
      '![Safe Cover](/images/2026/draft-title/cover.png)'
    );
  });
});
