import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreatePostPayload } from '@/services/session/admin';

const mockCreatePostPR = vi.fn();
const mockUploadPostImages = vi.fn();
const mockToast = vi.fn();
const mockLogout = vi.fn();
const mockGetValidAccessToken = vi.fn();

vi.mock('@/services/session/admin', () => ({
  createPostPR: (...args: unknown[]) => mockCreatePostPR(...args),
  uploadPostImages: (...args: unknown[]) => mockUploadPostImages(...args),
}));

vi.mock('@/stores/session/useAuthStore', () => ({
  useAuthStore: () => ({
    logout: mockLogout,
    getValidAccessToken: mockGetValidAccessToken,
  }),
}));

vi.mock('@/hooks/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/components/features/blog/MarkdownRenderer', () => ({
  default: ({ content, postPath }: { content: string; postPath?: string }) => (
    <div data-testid="markdown-preview">
      <span data-testid="preview-post-path">{postPath}</span>
      <pre>{content}</pre>
    </div>
  ),
}));

vi.mock('@/components/features/admin/AiImageGeneratorPanel', () => ({
  default: () => <div data-testid="ai-image-panel" />,
}));

vi.mock('@/components/features/admin/BotChatPanel', () => ({
  default: () => <div data-testid="bot-chat-panel" />,
}));

import NewPost from '@/pages/admin/NewPost';

function renderNewPost() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NewPost />
    </QueryClientProvider>,
  );
}

function imageDropEvent(file: File) {
  return {
    dataTransfer: {
      items: [
        {
          kind: 'file',
          type: file.type,
          getAsFile: () => file,
        },
      ],
      files: [file],
    },
  };
}

function changeField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), {
    target: { value },
  });
}

describe('NewPost authoring workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetValidAccessToken.mockResolvedValue('admin-access-token');
    mockCreatePostPR.mockResolvedValue({
      status: 'pending',
      outboxId: 'outbox-1',
      branch: 'post/2026-live-preview',
      path: 'frontend/public/posts/2026/live-preview.md',
    });
    mockUploadPostImages.mockResolvedValue({
      dir: '/images/2026/live-preview',
      items: [
        {
          url: '/images/2026/live-preview/drop.png',
          variantWebp: { url: '/images/2026/live-preview/drop.webp' },
        },
      ],
    });

    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    };
  });

  it('uploads dropped images and renders the inserted markdown immediately', async () => {
    renderNewPost();

    changeField('제목', 'Live Preview');
    await waitFor(() => {
      expect(screen.getByLabelText('슬러그')).toHaveValue('live-preview');
    });
    const editor = screen.getByLabelText('내용 (Markdown)');
    fireEvent.change(editor, { target: { value: 'Intro paragraph' } });

    const file = new File(['png'], 'drop.png', { type: 'image/png' });
    fireEvent.drop(editor, imageDropEvent(file));

    await waitFor(() => {
      expect(mockUploadPostImages).toHaveBeenCalledWith(
        { year: '2026', slug: 'live-preview' },
        [file],
        'admin-access-token',
      );
    });

    await waitFor(() => {
      expect((editor as HTMLTextAreaElement).value).toContain(
        '![image](/images/2026/live-preview/drop.webp)',
      );
    });
    expect((editor as HTMLTextAreaElement).value.match(/!\[image]/g)).toHaveLength(1);

    expect(screen.getByTestId('preview-post-path')).toHaveTextContent(
      '2026/live-preview',
    );
    expect(screen.getByTestId('markdown-preview')).toHaveTextContent(
      '![image](/images/2026/live-preview/drop.webp)',
    );
  });

  it('submits the current editor state to the create-post PR backend contract', async () => {
    renderNewPost();

    changeField('제목', 'Release Notes');
    changeField('카테고리', 'Engineering');
    changeField('태그 (쉼표로 구분)', 'react, admin');
    changeField('내용 (Markdown)', '## Change\n\nDone.');
    fireEvent.click(screen.getByRole('button', { name: /PR 생성 및 배포하기/ }));

    await waitFor(() => {
      expect(mockCreatePostPR).toHaveBeenCalledTimes(1);
    });

    const [payload, token] = mockCreatePostPR.mock.calls[0] as [
      CreatePostPayload,
      string,
    ];
    expect(token).toBe('admin-access-token');
    expect(payload).toMatchObject({
      title: 'Release Notes',
      slug: 'release-notes',
      year: '2026',
      content: expect.stringContaining('## Change'),
      frontmatter: {
        category: 'Engineering',
        tags: ['react', 'admin'],
        published: true,
      },
    });
  });
});
