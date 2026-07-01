import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Bold,
  CheckCircle2,
  Code2,
  Copy,
  FilePlus2,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  Loader2,
  LogOut,
  PanelRight,
  Quote,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import AiImageGeneratorPanel from '@/components/features/admin/AiImageGeneratorPanel';
import BotChatPanel from '@/components/features/admin/BotChatPanel';
import MarkdownRenderer from '@/components/features/blog/MarkdownRenderer';
import { useToast } from '@/hooks/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  createPostPR,
  uploadPostImages,
  type CreatePostPayload,
} from '@/services/session/admin';
import { useAuthStore } from '@/stores/session/useAuthStore';

const DRAFT_STORAGE_KEY = 'noblog.admin.postEditor.draft.v2';

type SubmitMode = 'publish' | 'draft';

type AttachedImage = {
  id: string;
  url: string;
  markdown: string;
  name: string;
  source: 'upload' | 'generated';
};

type DraftState = {
  title: string;
  slug: string;
  year: string;
  category: string;
  tags: string;
  published: boolean;
  coverImage: string;
  content: string;
  updatedAt: string;
};

function createLocalId(prefix: string): string {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function formatDraftTime(value: string | null): string {
  if (!value) return 'not saved';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getImageUrl(item: {
  url: string;
  variantWebp?: { url: string } | null;
}): string {
  return item.variantWebp?.url || item.url;
}

function getImageFilesFromDrop(event: DragEvent<HTMLElement>): File[] {
  const files: File[] = [];
  const { items } = event.dataTransfer;

  if (items?.length) {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    return files;
  }

  return Array.from(event.dataTransfer.files).filter(file =>
    file.type.startsWith('image/'),
  );
}

function getImageFilesFromClipboard(
  event: React.ClipboardEvent<HTMLTextAreaElement>,
): File[] {
  const files: File[] = [];
  const { items } = event.clipboardData;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }

  return files;
}

export function PostEditorWorkspace() {
  const { toast } = useToast();
  const { logout: storeLogout, getValidAccessToken } = useAuthStore();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState('');
  const [published, setPublished] = useState(true);
  const [coverImage, setCoverImage] = useState('');
  const [content, setContent] = useState('## 개요\n\n');
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [failedUploadAttempt, setFailedUploadAttempt] = useState<{
    files: File[];
    message: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [editorMode, setEditorMode] = useState<'write' | 'preview' | 'split'>(
    'split',
  );
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    if (!slugTouched && title.trim()) {
      setSlug(normalizeSlug(title));
    }
  }, [slugTouched, title]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setDraftReady(true);
      return;
    }

    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      setDraftReady(true);
      return;
    }

    try {
      const draft = JSON.parse(raw) as Partial<DraftState>;
      setTitle(draft.title || '');
      setSlug(draft.slug || '');
      setSlugTouched(Boolean(draft.slug));
      setYear(draft.year || new Date().getFullYear().toString());
      setCategory(draft.category || 'General');
      setTags(draft.tags || '');
      setPublished(draft.published ?? true);
      setCoverImage(draft.coverImage || '');
      setContent(draft.content || '## 개요\n\n');
      setDraftSavedAt(draft.updatedAt || null);
      if (draft.updatedAt) {
        toast({
          title: '임시 저장 복원',
          description: `${formatDraftTime(draft.updatedAt)} 저장본을 불러왔습니다.`,
        });
      }
    } catch {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } finally {
      setDraftReady(true);
    }
  }, [toast]);

  const currentDraft = useMemo<DraftState>(
    () => ({
      title,
      slug,
      year,
      category,
      tags,
      published,
      coverImage,
      content,
      updatedAt: new Date().toISOString(),
    }),
    [category, content, coverImage, published, slug, tags, title, year],
  );

  const saveDraft = useCallback(
    (showToast: boolean) => {
      if (typeof window === 'undefined') return;

      setDraftStatus('saving');
      const nextDraft = {
        ...currentDraft,
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextDraft));
      setDraftSavedAt(nextDraft.updatedAt);
      setDraftStatus('saved');
      window.setTimeout(() => setDraftStatus('idle'), 1200);

      if (showToast) {
        toast({
          title: '임시 저장 완료',
          description: '브라우저 로컬 임시 저장소에 저장했습니다.',
        });
      }
    },
    [currentDraft, toast],
  );

  useEffect(() => {
    if (!draftReady) return undefined;
    const timeoutId = window.setTimeout(() => saveDraft(false), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [draftReady, saveDraft]);

  const clearDraft = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
    setDraftSavedAt(null);
    setDraftStatus('idle');
    toast({ title: '임시 저장 삭제', description: '로컬 저장본을 삭제했습니다.' });
  };

  const insertAtCursor = useCallback((rawMarkdown: string) => {
    const markdown = rawMarkdown.endsWith('\n') ? rawMarkdown : `${rawMarkdown}\n`;
    const textarea = textareaRef.current;

    if (!textarea) {
      setContent(previous =>
        previous
          ? `${previous}${previous.endsWith('\n') ? '' : '\n'}${markdown}`
          : markdown,
      );
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setContent(previous => {
      const before = previous.slice(0, start);
      const after = previous.slice(end);
      const prefix = before && !before.endsWith('\n') ? '\n' : '';
      const suffix = after && !markdown.endsWith('\n') ? '\n' : '';
      return `${before}${prefix}${markdown}${suffix}${after}`;
    });

    window.requestAnimationFrame(() => {
      textarea.focus();
      const nextPosition = start + markdown.length + (start > 0 ? 1 : 0);
      textarea.setSelectionRange(nextPosition, nextPosition);
    });
  }, []);

  const wrapSelection = useCallback((prefix: string, suffix = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      insertAtCursor(`${prefix}${suffix}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setContent(previous => {
      const selected = previous.slice(start, end) || 'text';
      return `${previous.slice(0, start)}${prefix}${selected}${suffix}${previous.slice(end)}`;
    });

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    });
  }, [insertAtCursor]);

  const previewContent = useMemo(() => {
    const lines: string[] = [];
    if (title.trim()) lines.push(`# ${title.trim()}`);
    if (coverImage.trim()) lines.push(`![cover](${coverImage.trim()})`);
    if (tags.trim()) lines.push(`> tags: ${tags}`);
    if (category.trim()) lines.push(`> category: ${category}`);
    if (!published) lines.push('> status: draft');
    if (lines.length) lines.push('');
    return [lines.join('\n'), content].filter(Boolean).join('\n');
  }, [category, content, coverImage, published, tags, title]);

  const stats = useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const imageCount = (content.match(/!\[[^\]]*]\([^)]+\)/g) || []).length;
    return {
      words,
      chars: content.length,
      minutes: Math.max(1, Math.ceil(words / 220)),
      imageCount,
    };
  }, [content]);

  const createPr = useMutation({
    mutationFn: async (mode: SubmitMode) => {
      const publishNow = mode === 'publish' && published;
      const payload: CreatePostPayload = {
        title: title.trim() || slug.trim() || 'New Post',
        slug: slug.trim() || undefined,
        year,
        content,
        draft: !publishNow,
        frontmatter: {
          category: category || 'General',
          tags: tags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean),
          coverImage: coverImage || undefined,
          published: publishNow,
        },
      };

      return createPostPR(payload);
    },
    onSuccess: data => {
      if (data.prUrl) {
        toast({ title: 'PR 생성됨', description: data.prUrl });
        try {
          window.open(data.prUrl, '_blank', 'noopener,noreferrer');
        } catch {
          void 0;
        }
        return;
      }

      toast({
        title: 'PR 작업 등록됨',
        description: data.outboxId ? `Outbox: ${data.outboxId}` : data.path,
      });
    },
    onError: error => {
      toast({
        title: 'PR 생성 실패',
        description: getErrorMessage(error, '오류'),
        variant: 'destructive',
      });
    },
  });

  const logout = async () => {
    await storeLogout();
    window.dispatchEvent(new Event('admin-auth-changed'));
  };

  const appendAttachedImage = useCallback(
    (url: string, name: string, source: AttachedImage['source'], markdown?: string) => {
      const alt = title.trim() || name.replace(/\.[^.]+$/, '') || 'image';
      const itemMarkdown = markdown || `![${alt}](${url})`;
      setAttachedImages(previous => [
        {
          id: createLocalId(source),
          url,
          markdown: itemMarkdown,
          name,
          source,
        },
        ...previous,
      ]);
      return itemMarkdown;
    },
    [title],
  );

  const handleImageUploads = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length === 0) {
        toast({
          title: '이미지 없음',
          description: 'PNG, JPG, WebP, GIF 이미지만 첨부할 수 있습니다.',
          variant: 'destructive',
        });
        return;
      }

      try {
        if (!/^[0-9]{4}$/.test(year)) throw new Error('연도(YYYY)를 입력하세요');
        if (!slug.trim()) {
          throw new Error('슬러그를 먼저 입력하세요. 이미지 저장 경로에 필요합니다.');
        }

        setIsUploading(true);
        setFailedUploadAttempt(null);
        const result = await uploadPostImages(
          { year, slug: slug.trim() },
          imageFiles,
        );

        result.items.forEach((item, index) => {
          const url = getImageUrl(item);
          const original = imageFiles[index];
          const markdown = appendAttachedImage(
            url,
            original?.name || url.split('/').pop() || 'image',
            'upload',
          );
          insertAtCursor(markdown);
        });

        toast({
          title: '이미지 첨부 완료',
          description: `${result.items.length}개 이미지를 본문에 삽입했습니다.`,
        });
      } catch (error) {
        const message = getErrorMessage(error, '업로드 실패');
        setFailedUploadAttempt({ files: imageFiles, message });
        toast({
          title: '이미지 첨부 실패',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setIsUploading(false);
      }
    },
    [
      appendAttachedImage,
      insertAtCursor,
      slug,
      toast,
      year,
    ],
  );

  const handleFileInputUpload = async () => {
    const input = fileInputRef.current;
    const files = input?.files ? Array.from(input.files) : [];
    if (!files.length) {
      toast({
        title: '선택된 파일 없음',
        description: '첨부할 이미지를 선택하세요.',
        variant: 'destructive',
      });
      return;
    }

    await handleImageUploads(files);
    if (input) input.value = '';
  };

  const handlePaste = async (
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const imageFiles = getImageFilesFromClipboard(event);
    if (!imageFiles.length) return;
    event.preventDefault();
    await handleImageUploads(imageFiles);
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setDragActive(false);

    const imageFiles = getImageFilesFromDrop(event);
    if (imageFiles.length > 0) {
      await handleImageUploads(imageFiles);
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    if (event.dataTransfer.types.includes('Files')) setDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  };

  const handleGeneratedMarkdownInsert = useCallback(
    (markdown: string) => {
      const urlMatch = markdown.match(/\(([^)]+)\)/);
      if (urlMatch?.[1]) {
        appendAttachedImage(
          urlMatch[1],
          urlMatch[1].split('/').pop() || 'generated-image',
          'generated',
          markdown,
        );
      }
      insertAtCursor(markdown);
    },
    [appendAttachedImage, insertAtCursor],
  );

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: '복사 완료' });
  };

  const insertLink = () => {
    const url =
      typeof window !== 'undefined'
        ? window.prompt('URL', 'https://')
        : 'https://';
    if (!url) return;
    wrapSelection('[', `](${url})`);
  };

  const editorToolbar = [
    {
      label: 'Heading',
      icon: Heading2,
      action: () => insertAtCursor('## 섹션 제목\n\n'),
    },
    { label: 'Bold', icon: Bold, action: () => wrapSelection('**') },
    { label: 'Italic', icon: Italic, action: () => wrapSelection('*') },
    { label: 'Quote', icon: Quote, action: () => insertAtCursor('> 인용문\n') },
    { label: 'List', icon: List, action: () => insertAtCursor('- 항목\n') },
    {
      label: 'Code block',
      icon: Code2,
      action: () => insertAtCursor('```ts\n// code\n```\n'),
    },
    { label: 'Link', icon: Link, action: insertLink },
  ];

  return (
    <div className='mx-auto max-w-screen-2xl space-y-4'>
      <section className='rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'>
        <div className='flex flex-col gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between'>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <h1 className='text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
                게시글 작성
              </h1>
              <Badge variant='secondary' className='rounded-md'>
                {published ? 'public' : 'draft'}
              </Badge>
              <Badge variant='outline' className='rounded-md font-mono'>
                {year || 'YYYY'}/{slug || 'slug'}
              </Badge>
            </div>
            <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
              드래그 앤 드랍 이미지 첨부, 임시 저장, AI 작성 지원, 이미지 생성 후 즉시 삽입을 한 화면에서 처리합니다.
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <span className='rounded-md border border-zinc-200 px-2 py-1 font-mono text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400'>
              draft {draftStatus === 'saving' ? 'saving...' : formatDraftTime(draftSavedAt)}
            </span>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => saveDraft(true)}
              className='min-h-9 rounded-lg'
            >
              <Save className='h-4 w-4' aria-hidden='true' />
              임시 저장
            </Button>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={() => createPr.mutate('draft')}
              disabled={createPr.isPending}
              className='min-h-9 rounded-lg'
            >
              {createPr.isPending ? (
                <Loader2 className='h-4 w-4 animate-spin motion-reduce:animate-none' />
              ) : (
                <FilePlus2 className='h-4 w-4' />
              )}
              Draft PR
            </Button>
            <Button
              type='button'
              size='sm'
              onClick={() => createPr.mutate('publish')}
              disabled={createPr.isPending}
              className='min-h-9 rounded-lg'
            >
              <Send className='h-4 w-4' aria-hidden='true' />
              게시 PR
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => void logout()}
              className='min-h-9 rounded-lg text-zinc-500 hover:text-red-600'
            >
              <LogOut className='h-4 w-4' aria-hidden='true' />
              로그아웃
            </Button>
          </div>
        </div>

        <div className='grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_390px]'>
          <main className='min-w-0 space-y-4'>
            <section className='grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40 md:grid-cols-2 xl:grid-cols-4'>
              <div className='space-y-1.5 md:col-span-2'>
                <Label htmlFor='post-editor-title' className='text-xs'>
                  제목
                </Label>
                <Input
                  id='post-editor-title'
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  placeholder='글 제목'
                  className='h-10 rounded-lg bg-white text-sm dark:bg-zinc-900'
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='post-editor-slug' className='text-xs'>
                  슬러그
                </Label>
                <div className='flex gap-2'>
                  <Input
                    id='post-editor-slug'
                    value={slug}
                    onChange={event => {
                      setSlugTouched(true);
                      setSlug(normalizeSlug(event.target.value));
                    }}
                    placeholder='my-new-post'
                    className='h-10 rounded-lg bg-white font-mono text-sm dark:bg-zinc-900'
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    onClick={() => {
                      setSlugTouched(true);
                      setSlug(normalizeSlug(title));
                    }}
                    aria-label='제목으로 슬러그 생성'
                    title='제목으로 슬러그 생성'
                    className='h-10 w-10 rounded-lg'
                  >
                    <RotateCcw className='h-4 w-4' aria-hidden='true' />
                  </Button>
                </div>
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='post-editor-year' className='text-xs'>
                  연도
                </Label>
                <Input
                  id='post-editor-year'
                  value={year}
                  onChange={event => setYear(event.target.value)}
                  placeholder='2026'
                  className='h-10 rounded-lg bg-white font-mono text-sm dark:bg-zinc-900'
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='post-editor-category' className='text-xs'>
                  카테고리
                </Label>
                <Input
                  id='post-editor-category'
                  value={category}
                  onChange={event => setCategory(event.target.value)}
                  placeholder='General'
                  className='h-10 rounded-lg bg-white text-sm dark:bg-zinc-900'
                />
              </div>
              <div className='space-y-1.5 md:col-span-2'>
                <Label htmlFor='post-editor-tags' className='text-xs'>
                  태그
                </Label>
                <Input
                  id='post-editor-tags'
                  value={tags}
                  onChange={event => setTags(event.target.value)}
                  placeholder='react, typescript'
                  className='h-10 rounded-lg bg-white text-sm dark:bg-zinc-900'
                />
              </div>
              <div className='space-y-1.5 md:col-span-2'>
                <Label htmlFor='post-editor-cover' className='text-xs'>
                  커버 이미지 URL
                </Label>
                <Input
                  id='post-editor-cover'
                  value={coverImage}
                  onChange={event => setCoverImage(event.target.value)}
                  placeholder='/images/cover.png'
                  className='h-10 rounded-lg bg-white font-mono text-sm dark:bg-zinc-900'
                />
              </div>
              <div className='flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900 md:col-span-2 xl:col-span-4'>
                <div>
                  <Label htmlFor='post-editor-published' className='text-xs'>
                    공개 상태
                  </Label>
                  <p className='text-xs text-zinc-400'>
                    Draft PR은 이 값과 관계없이 draft로 생성됩니다.
                  </p>
                </div>
                <label className='inline-flex min-h-10 items-center gap-2 text-sm'>
                  <input
                    id='post-editor-published'
                    type='checkbox'
                    checked={published}
                    onChange={event => setPublished(event.target.checked)}
                    className='h-4 w-4 rounded border-zinc-300'
                  />
                  공개
                </label>
              </div>
            </section>

            <section
              className={cn(
                'relative rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
                dragActive && 'border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900/60',
              )}
              data-testid='post-editor-dropzone'
              onDragEnter={handleDragEnter}
              onDragOver={event => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onDragLeave={handleDragLeave}
              onDrop={event => {
                void handleDrop(event);
              }}
            >
              {dragActive && (
                <div className='pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-blue-50/90 text-sm font-semibold text-blue-700 dark:bg-blue-950/80 dark:text-blue-200'>
                  <UploadCloud className='mr-2 h-5 w-5' aria-hidden='true' />
                  이미지를 놓으면 본문에 첨부됩니다.
                </div>
              )}

              <div className='flex flex-col gap-3 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800 md:flex-row md:items-center md:justify-between'>
                <div className='flex flex-wrap items-center gap-1'>
                  {editorToolbar.map(item => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.label}
                        type='button'
                        variant='ghost'
                        size='icon'
                        onClick={item.action}
                        aria-label={item.label}
                        title={item.label}
                        className='h-9 w-9 rounded-lg'
                      >
                        <Icon className='h-4 w-4' aria-hidden='true' />
                      </Button>
                    );
                  })}
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className='ml-1 min-h-9 rounded-lg'
                  >
                    {isUploading ? (
                      <Loader2 className='h-4 w-4 animate-spin motion-reduce:animate-none' />
                    ) : (
                      <ImageIcon className='h-4 w-4' />
                    )}
                    이미지 첨부
                  </Button>
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='image/*'
                    multiple
                    className='sr-only'
                    onChange={() => {
                      void handleFileInputUpload();
                    }}
                  />
                </div>

                <div className='flex items-center gap-2'>
                  <Tabs
                    value={editorMode}
                    onValueChange={value =>
                      setEditorMode(value as 'write' | 'preview' | 'split')
                    }
                  >
                    <TabsList className='h-9 rounded-lg'>
                      <TabsTrigger value='write' className='h-7 rounded-md text-xs'>
                        Write
                      </TabsTrigger>
                      <TabsTrigger value='split' className='h-7 rounded-md text-xs'>
                        Split
                      </TabsTrigger>
                      <TabsTrigger value='preview' className='h-7 rounded-md text-xs'>
                        Preview
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              {failedUploadAttempt && (
                <div className='m-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'>
                  <div className='font-medium'>업로드가 중단되었습니다.</div>
                  <div className='mt-1 text-xs'>{failedUploadAttempt.message}</div>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    className='mt-2 min-h-9 rounded-lg'
                    disabled={isUploading}
                    onClick={() => {
                      void handleImageUploads(failedUploadAttempt.files);
                    }}
                  >
                    실패한 업로드 다시 시도
                  </Button>
                </div>
              )}

              <div
                className={cn(
                  'grid min-h-[560px]',
                  editorMode === 'split' && 'lg:grid-cols-2',
                )}
              >
                {editorMode !== 'preview' && (
                  <div className='min-w-0 border-zinc-100 dark:border-zinc-800 lg:border-r'>
                    <Textarea
                      ref={textareaRef}
                      aria-label='Markdown content editor'
                      value={content}
                      onChange={event => setContent(event.target.value)}
                      onPaste={event => {
                        void handlePaste(event);
                      }}
                      className='min-h-[560px] resize-y rounded-none border-0 bg-white font-mono text-sm leading-6 shadow-none focus-visible:ring-0 dark:bg-zinc-900'
                      placeholder='Markdown으로 본문을 작성하세요.'
                    />
                  </div>
                )}
                {editorMode !== 'write' && (
                  <ScrollArea className='min-h-[560px] bg-zinc-50/70 dark:bg-zinc-950/40'>
                    <div className='prose prose-zinc max-w-none p-5 dark:prose-invert'>
                      <MarkdownRenderer content={previewContent} />
                    </div>
                  </ScrollArea>
                )}
              </div>

              <div className='flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span>{stats.words} words</span>
                  <span>{stats.chars} chars</span>
                  <span>{stats.minutes} min</span>
                  <span>{stats.imageCount} images</span>
                </div>
                <div className='flex items-center gap-2'>
                  {draftStatus === 'saved' && (
                    <span className='inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400'>
                      <CheckCircle2 className='h-3.5 w-3.5' aria-hidden='true' />
                      saved
                    </span>
                  )}
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={clearDraft}
                    className='h-8 rounded-lg px-2 text-xs'
                  >
                    임시 저장 삭제
                  </Button>
                </div>
              </div>
            </section>
          </main>

          <aside className='min-w-0 space-y-4'>
            <Tabs defaultValue='assistant' className='rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'>
              <div className='flex items-center justify-between border-b border-zinc-100 px-3 py-2 dark:border-zinc-800'>
                <TabsList className='h-9 rounded-lg'>
                  <TabsTrigger value='assistant' className='h-7 rounded-md text-xs'>
                    <Sparkles className='mr-1 h-3.5 w-3.5' aria-hidden='true' />
                    Assistant
                  </TabsTrigger>
                  <TabsTrigger value='images' className='h-7 rounded-md text-xs'>
                    <ImageIcon className='mr-1 h-3.5 w-3.5' aria-hidden='true' />
                    Images
                  </TabsTrigger>
                  <TabsTrigger value='assets' className='h-7 rounded-md text-xs'>
                    <PanelRight className='mr-1 h-3.5 w-3.5' aria-hidden='true' />
                    Assets
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value='assistant' className='m-0 h-[640px]'>
                <BotChatPanel
                  title={title}
                  slug={slug}
                  year={year}
                  category={category}
                  tags={tags}
                  coverImage={coverImage}
                  content={content}
                  setTitle={setTitle}
                  setSlug={value => {
                    setSlugTouched(true);
                    setSlug(normalizeSlug(value));
                  }}
                  setContent={setContent}
                  setTags={setTags}
                  setCategory={setCategory}
                  setCoverImage={setCoverImage}
                  onInsertMarkdown={insertAtCursor}
                  getAccessToken={getValidAccessToken}
                />
              </TabsContent>

              <TabsContent value='images' className='m-0 p-3'>
                <AiImageGeneratorPanel
                  title={title}
                  category={category}
                  tags={tags}
                  content={content}
                  year={year}
                  slug={slug}
                  getAccessToken={getValidAccessToken}
                  onInsertMarkdown={handleGeneratedMarkdownInsert}
                  onSetCoverImage={setCoverImage}
                />
              </TabsContent>

              <TabsContent value='assets' className='m-0'>
                <div className='space-y-3 p-3'>
                  <div className='flex items-center justify-between'>
                    <h2 className='text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
                      첨부 이미지
                    </h2>
                    <Badge variant='outline' className='rounded-md'>
                      {attachedImages.length}
                    </Badge>
                  </div>
                  {attachedImages.length === 0 ? (
                    <div className='flex min-h-44 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/40'>
                      <ImageIcon className='h-8 w-8' aria-hidden='true' />
                    </div>
                  ) : (
                    <div className='space-y-2'>
                      {attachedImages.map(item => (
                        <div
                          key={item.id}
                          className='grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800'
                        >
                          <img
                            src={item.url}
                            alt=''
                            loading='lazy'
                            className='h-16 w-16 rounded-md border border-zinc-200 object-cover dark:border-zinc-800'
                          />
                          <div className='min-w-0 space-y-2'>
                            <div className='flex items-center gap-2'>
                              <span className='truncate text-xs font-medium text-zinc-700 dark:text-zinc-300'>
                                {item.name}
                              </span>
                              <Badge variant='secondary' className='rounded-md text-[10px]'>
                                {item.source}
                              </Badge>
                            </div>
                            <div className='flex gap-2'>
                              <Button
                                type='button'
                                size='sm'
                                variant='secondary'
                                className='h-8 rounded-lg px-2 text-xs'
                                onClick={() => insertAtCursor(item.markdown)}
                              >
                                삽입
                              </Button>
                              <Button
                                type='button'
                                size='sm'
                                variant='outline'
                                className='h-8 rounded-lg px-2 text-xs'
                                onClick={() => setCoverImage(item.url)}
                              >
                                커버
                              </Button>
                              <Button
                                type='button'
                                size='sm'
                                variant='ghost'
                                className='h-8 rounded-lg px-2 text-xs'
                                aria-label={`${item.name} URL 복사`}
                                onClick={() => void copyText(item.url)}
                              >
                                <Copy className='h-3.5 w-3.5' aria-hidden='true' />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </aside>
        </div>
      </section>
    </div>
  );
}
