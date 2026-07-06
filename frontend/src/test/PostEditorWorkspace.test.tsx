import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PostEditorWorkspace } from '@/components/features/admin/content/PostEditorWorkspace';

const mocks = vi.hoisted(() => ({
  createPostPR: vi.fn(),
  logout: vi.fn(async () => undefined),
  uploadPostImages: vi.fn(),
}));

vi.mock('@/services/session/admin', () => ({
  createPostPR: mocks.createPostPR,
  uploadPostImages: mocks.uploadPostImages,
}));

vi.mock('@/stores/session/useAuthStore', () => ({
  useAuthStore: () => ({
    logout: mocks.logout,
  }),
}));

vi.mock('@/components/features/blog/MarkdownRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid='markdown-preview'>{content}</div>
  ),
}));

vi.mock('@/components/features/admin/BotChatPanel', () => ({
  default: ({
    onInsertMarkdown,
  }: {
    onInsertMarkdown: (markdown: string) => void;
  }) => (
    <button type='button' onClick={() => onInsertMarkdown('AI assisted draft')}>
      Mock AI assistant
    </button>
  ),
}));

vi.mock('@/components/features/admin/AiImageGeneratorPanel', () => ({
  default: ({
    onInsertMarkdown,
  }: {
    onInsertMarkdown: (markdown: string) => void;
  }) => (
    <button
      type='button'
      onClick={() => onInsertMarkdown('![generated](/images/generated.png)')}
    >
      Mock image generation attach
    </button>
  ),
}));

function renderEditor() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PostEditorWorkspace />
    </QueryClientProvider>,
  );
}

describe('PostEditorWorkspace', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.createPostPR.mockResolvedValue({
      status: 'pending',
      outboxId: 'outbox-1',
      branch: 'post/draft-title',
      path: 'frontend/public/posts/2026/draft-title.md',
    });
    mocks.uploadPostImages.mockResolvedValue({
      dir: '/images/2026/drag-hero',
      items: [
        {
          url: '/images/2026/drag-hero/hero.png',
          variantWebp: { url: '/images/2026/drag-hero/hero.webp' },
        },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('saves a local draft and restores it on the next mount', async () => {
    const firstRender = renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: '임시 저장 테스트' },
    });
    fireEvent.change(screen.getByLabelText('Markdown content editor'), {
      target: { value: '본문 초안입니다.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^임시 저장$/ }));

    expect(
      window.localStorage.getItem('noblog.admin.postEditor.draft.v2'),
    ).toContain('본문 초안입니다.');

    firstRender.unmount();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByLabelText('제목')).toHaveValue('임시 저장 테스트');
    });
    expect(screen.getByLabelText('Markdown content editor')).toHaveValue(
      '본문 초안입니다.',
    );
  });

  it('creates draft PRs through the admin session service without token plumbing', async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: 'Draft Title' },
    });
    fireEvent.change(screen.getByLabelText('슬러그'), {
      target: { value: 'draft-title' },
    });
    fireEvent.change(screen.getByLabelText('Markdown content editor'), {
      target: { value: '# Draft Title\n\nBody' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Draft PR/i }));

    await waitFor(() => {
      expect(mocks.createPostPR).toHaveBeenCalledTimes(1);
    });

    expect(mocks.createPostPR.mock.calls[0]).toHaveLength(1);
    expect(mocks.createPostPR).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Draft Title',
        slug: 'draft-title',
        content: '# Draft Title\n\nBody',
        draft: true,
      }),
    );
  });

  it('normalizes post path fields before creating draft PRs', async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: ' Draft Title\r\nX-Injected: yes ' },
    });
    fireEvent.change(screen.getByLabelText('슬러그'), {
      target: { value: '../Draft Title\r\nX-Injected: yes' },
    });
    fireEvent.change(screen.getByLabelText('Markdown content editor'), {
      target: { value: '# Draft Title\n\nBody' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Draft PR/i }));

    await waitFor(() => {
      expect(mocks.createPostPR).toHaveBeenCalledTimes(1);
    });

    expect(mocks.createPostPR).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Draft Title X-Injected: yes',
        slug: 'draft-title-x-injected-yes',
      }),
    );
  });

  it('uploads a dropped image and inserts the returned markdown into content', async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: 'Drag Hero' },
    });
    fireEvent.change(screen.getByLabelText('슬러그'), {
      target: { value: 'drag-hero' },
    });

    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    fireEvent.drop(screen.getByTestId('post-editor-dropzone'), {
      dataTransfer: {
        files: [file],
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
        types: ['Files'],
      },
    });

    await waitFor(() => {
      expect(mocks.uploadPostImages).toHaveBeenCalledWith(
        { year: expect.any(String), slug: 'drag-hero' },
        [file],
      );
    });
    expect(mocks.uploadPostImages.mock.calls[0]).toHaveLength(2);

    expect(
      (screen.getByLabelText('Markdown content editor') as HTMLTextAreaElement)
        .value,
    ).toContain('![Drag Hero](/images/2026/drag-hero/hero.webp)');

    const assetsTab = screen.getByRole('tab', { name: /Assets/i });
    fireEvent.mouseDown(assetsTab, { button: 0, ctrlKey: false });
    fireEvent.pointerDown(assetsTab, { button: 0, ctrlKey: false });
    fireEvent.click(assetsTab);

    expect(await screen.findByRole('button', { name: 'hero.png URL 복사' }))
      .toHaveAttribute('title', 'hero.png URL 복사');
  });

  it('normalizes the image upload path slug before uploading dropped images', async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: 'Drag Hero' },
    });
    fireEvent.change(screen.getByLabelText('슬러그'), {
      target: { value: '../Drag Hero\r\nX-Injected: yes' },
    });

    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    fireEvent.drop(screen.getByTestId('post-editor-dropzone'), {
      dataTransfer: {
        files: [file],
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
        types: ['Files'],
      },
    });

    await waitFor(() => {
      expect(mocks.uploadPostImages).toHaveBeenCalledWith(
        { year: expect.any(String), slug: 'drag-hero-x-injected-yes' },
        [file],
      );
    });
  });

  it('lets assistant and generated-image panels attach content through the editor contract', async () => {
    renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Mock AI assistant' }));
    expect(
      (screen.getByLabelText('Markdown content editor') as HTMLTextAreaElement)
        .value,
    ).toContain('AI assisted draft');

    const imagesTab = screen.getByRole('tab', { name: /Images/i });
    fireEvent.mouseDown(imagesTab, { button: 0, ctrlKey: false });
    fireEvent.pointerDown(imagesTab, { button: 0, ctrlKey: false });
    fireEvent.click(imagesTab);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Mock image generation attach' }),
      ).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Mock image generation attach' }),
    );

    expect(
      (screen.getByLabelText('Markdown content editor') as HTMLTextAreaElement)
        .value,
    ).toContain('![generated](/images/generated.png)');
  });

  it('restores the cursor after generated markdown without adding phantom newline offset', async () => {
    renderEditor();

    const editor = screen.getByLabelText(
      'Markdown content editor',
    ) as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: { value: '첫 문단\n둘째 문단' },
    });
    editor.focus();
    editor.setSelectionRange(4, 4);

    const imagesTab = screen.getByRole('tab', { name: /Images/i });
    fireEvent.mouseDown(imagesTab, { button: 0, ctrlKey: false });
    fireEvent.pointerDown(imagesTab, { button: 0, ctrlKey: false });
    fireEvent.click(imagesTab);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Mock image generation attach',
      }),
    );

    await waitFor(() => {
      expect(editor.selectionStart).toBe(
        '첫 문단\n'.length + '![generated](/images/generated.png)\n'.length,
      );
    });
    expect(editor.selectionEnd).toBe(editor.selectionStart);
    expect(editor.value).toBe(
      '첫 문단\n![generated](/images/generated.png)\n둘째 문단',
    );
  });
});

describe('PostEditorWorkspace cover image URL boundaries', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.createPostPR.mockResolvedValue({
      status: 'pending',
      outboxId: 'outbox-1',
      branch: 'post/draft-title',
      path: 'frontend/public/posts/2026/draft-title.md',
    });
    mocks.uploadPostImages.mockResolvedValue({
      dir: '/images/2026/draft-title',
      items: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('omits unsafe cover image URLs from draft PR payloads', async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: 'Draft Title' },
    });
    fireEvent.change(screen.getByLabelText('슬러그'), {
      target: { value: 'draft-title' },
    });
    fireEvent.change(screen.getByLabelText('Markdown content editor'), {
      target: { value: '# Draft Title\n\nBody' },
    });
    fireEvent.change(screen.getByLabelText('커버 이미지 URL'), {
      target: { value: 'https://user:pass@example.com/%0a.png' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Draft PR/i }));

    await waitFor(() => {
      expect(mocks.createPostPR).toHaveBeenCalledTimes(1);
    });

    expect(mocks.createPostPR).toHaveBeenCalledWith(
      expect.objectContaining({
        frontmatter: expect.objectContaining({
          coverImage: undefined,
        }),
      }),
    );
  });
});
