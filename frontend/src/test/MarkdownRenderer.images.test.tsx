import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/contexts/ThemeContext';
import MarkdownRenderer from '@/components/features/blog/MarkdownRenderer';

function renderMarkdown(content: string, postPath = '2026/awk-1') {
  return render(
    <ThemeProvider>
      <MarkdownRenderer content={content} postPath={postPath} />
    </ThemeProvider>
  );
}

describe('MarkdownRenderer image paths', () => {
  it('normalizes images/ relative markdown paths to root-relative public assets', async () => {
    const user = userEvent.setup();

    renderMarkdown('![NR](images/2026/awk-1/1.png)');

    const previewImage = screen.getByAltText('NR');
    expect(previewImage).toHaveAttribute(
      'data-src',
      '/images/2026/awk-1/1.thumb.webp'
    );

    await user.click(screen.getByRole('button', { name: /view nr in full size/i }));

    const lightboxImage = await screen.findByTestId('lightbox-image');
    expect(lightboxImage).toHaveAttribute('src', '/images/2026/awk-1/1.png');
  });

  it('keeps animated gifs on the original source so they animate inline', () => {
    renderMarkdown('![TRUE](images/2026/awk-1/12.gif)');

    const inlineGif = screen.getByAltText('TRUE');
    expect(inlineGif).toHaveAttribute('data-src', '/images/2026/awk-1/12.gif');
  });

  it('renders markdown video assets as autoplaying inline videos', () => {
    const { container } = renderMarkdown('![Demo](image/demo/clip.mp4)');

    const video = container.querySelector('video') as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('data-src', '/posts/2026/image/demo/clip.mp4');
    expect(video?.autoplay).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video).toHaveAttribute('playsinline');
  });
});
