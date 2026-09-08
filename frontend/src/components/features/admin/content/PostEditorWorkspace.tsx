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
  CheckCircle2,
  Copy,
  FilePlus2,
  Image as ImageIcon,
  Loader2,
  LogOut,
  PanelRight,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ActionButton } from '@/components/ui/action-button';
import { ActionToolbar } from '@/components/ui/action-toolbar';
import type { ActionIdOfKind } from '@/components/ui/action-definitions';
import { PaneSwitcher, WorkspacePanel } from '@/components/organisms/layout';
import { editorReviewSignature, isEditorReviewCurrent } from './editorReview';
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

function normalizeRequiredText(value: string, fallback: string): string {
  const normalized = value.trim().replace(/[\r\n]+/g, ' ');
  return normalized || fallback;
}

function normalizeOptionalField(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized || /[\r\n]/.test(normalized) || /%(?:0a|0d)/i.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function normalizeCoverImageUrl(value: string): string | undefined {
  const normalized = normalizeOptionalField(value);
  if (!normalized || /[\u0000-\u001F\u007F\\]/.test(normalized)) {
    return undefined;
  }
  if (/%(?:0[0-9a-f]|1[0-9a-f]|7f|2f|5c)/i.test(normalized)) {
    return undefined;
  }

  try {
    decodeURI(normalized);
  } catch {
    return undefined;
  }

  if (normalized.startsWith('/') && !normalized.startsWith('//')) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.username &&
      !parsed.password
    ) {
      return parsed.href;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function normalizePostYear(value: string): string | null {
  const normalized = value.trim();
  return /^[0-9]{4}$/.test(normalized) ? normalized : null;
}

function normalizeTagList(value: string): string[] {
  return value
    .split(',')
    .flatMap(tag => {
      const normalized = normalizeOptionalField(tag);
      return normalized ? [normalized] : [];
    });
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
  const { logout: storeLogout } = useAuthStore();

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
  const [mobilePane, setMobilePane] = useState<'write' | 'preview' | 'tools'>('write');
  const [submitReview, setSubmitReview] = useState<{ mode: SubmitMode; snapshot: DraftState; signature: string } | null>(null);
  const [submitFeedback, setSubmitFeedback] = useState('');
  const [submitOutcome, setSubmitOutcome] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [clearDraftOpen, setClearDraftOpen] = useState(false);
  const submitInFlight = useRef(false);
  const draftReadBlocked = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dragDepthRef = useRef(0);
  const uploadInFlightRef = useRef<boolean>(false);
  const draftAutosaveTimeoutRef = useRef<number | null>(null);
  const draftAutosaveVersionRef = useRef(0);

  const cancelPendingDraftAutosave = useCallback(() => {
    const timeoutId = draftAutosaveTimeoutRef.current;
    draftAutosaveTimeoutRef.current = null;
    draftAutosaveVersionRef.current += 1;
    if (timeoutId !== null && typeof window !== 'undefined') {
      window.clearTimeout(timeoutId);
    }
  }, []);

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

    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<DraftState>;
      const restoredSlug = draft.slug ? normalizeSlug(draft.slug) : '';
      setTitle(draft.title || '');
      setSlug(restoredSlug);
      setSlugTouched(Boolean(restoredSlug));
      setYear(normalizePostYear(draft.year || '') || new Date().getFullYear().toString());
      setCategory(normalizeRequiredText(draft.category || '', 'General'));
      setTags(normalizeTagList(draft.tags || '').join(', '));
      setPublished(draft.published ?? true);
      setCoverImage(normalizeCoverImageUrl(draft.coverImage || '') || '');
      setContent(typeof draft.content === 'string' ? draft.content : '## 개요\n\n');
      setDraftSavedAt(draft.updatedAt || null);
      if (draft.updatedAt) {
        toast({
          title: '임시 저장 복원',
          description: `${formatDraftTime(draft.updatedAt)} 저장본을 불러왔습니다.`,
        });
      }
    } catch {
      draftReadBlocked.current = true;
      setDraftError('로컬 저장본을 읽지 못해 자동 저장을 멈췄습니다. 저장본은 삭제하지 않았습니다. 수동으로 저장하면 현재 입력으로 로컬 저장본을 바꿉니다.');
      setDraftStatus('error');
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
      if (typeof window === 'undefined' || (draftReadBlocked.current && !showToast)) return;

      setDraftStatus('saving');
      const nextDraft = {
        ...currentDraft,
        updatedAt: new Date().toISOString(),
      };
      try {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextDraft));
      } catch {
        setDraftStatus('error');
        setDraftError('브라우저 로컬 저장에 실패했습니다. 입력은 이 화면에 남아 있습니다. 창을 닫기 전에 본문을 복사하거나 저장을 다시 시도하세요.');
        return;
      }
      draftReadBlocked.current = false;
      setDraftError(null);
      setDraftSavedAt(nextDraft.updatedAt);
      setDraftStatus('saved');

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
    if (!draftReady || typeof window === 'undefined') return undefined;

    cancelPendingDraftAutosave();
    const autosaveVersion = draftAutosaveVersionRef.current;
    const timeoutId = window.setTimeout(() => {
      if (
        draftAutosaveVersionRef.current !== autosaveVersion ||
        draftAutosaveTimeoutRef.current !== timeoutId
      ) {
        return;
      }

      draftAutosaveTimeoutRef.current = null;
      saveDraft(false);
    }, 1200);
    draftAutosaveTimeoutRef.current = timeoutId;

    return cancelPendingDraftAutosave;
  }, [cancelPendingDraftAutosave, draftReady, saveDraft]);

  const clearDraft = () => {
    if (typeof window !== 'undefined') {
      cancelPendingDraftAutosave();
      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        setDraftError('로컬 저장본을 삭제하지 못했습니다. 현재 편집 내용과 저장본을 유지합니다.');
        setDraftStatus('error');
        return;
      }
    }
    setDraftError(null);
    setClearDraftOpen(false);
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
    let prefixLength = 0;
    setContent(previous => {
      const before = previous.slice(0, start);
      const after = previous.slice(end);
      const prefix = before && !before.endsWith('\n') ? '\n' : '';
      const suffix = after && !markdown.endsWith('\n') ? '\n' : '';
      prefixLength = prefix.length;
      return `${before}${prefix}${markdown}${suffix}${after}`;
    });

    window.requestAnimationFrame(() => {
      textarea.focus();
      const nextPosition = start + prefixLength + markdown.length;
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
    const innerSelectionLength = end > start ? end - start : 'text'.length;
    setContent(previous => {
      const selected = previous.slice(start, end) || 'text';
      return `${previous.slice(0, start)}${prefix}${selected}${suffix}${previous.slice(end)}`;
    });

    window.requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + prefix.length;
      textarea.setSelectionRange(selectionStart, selectionStart + innerSelectionLength);
    });
  }, [insertAtCursor]);

  const previewContent = useMemo(() => {
    const lines: string[] = [];
    const safeCoverImage = normalizeCoverImageUrl(coverImage);
    if (title.trim()) lines.push(`# ${title.trim()}`);
    if (safeCoverImage) lines.push(`![cover](${safeCoverImage})`);
    if (tags.trim()) lines.push(`> tags: ${tags}`);
    if (category.trim()) lines.push(`> category: ${category}`);
    if (!published) lines.push('> status: draft');
    if (lines.length) lines.push('');
    return [lines.join('\n'), content].filter(Boolean).join('\n');
  }, [category, content, coverImage, published, tags, title]);

  const previewPostPath = useMemo(() => {
    const previewYear = normalizePostYear(year);
    if (!previewYear) return '';
    const previewSlug = normalizeSlug(slug || title) || 'preview';
    return `${previewYear}/${previewSlug}`;
  }, [slug, title, year]);

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
    mutationFn: async (submission: { mode: SubmitMode; snapshot: DraftState }) => {
      const { mode, snapshot } = submission;
      const { title, slug, year, category, tags, published, coverImage, content } = snapshot;
      const publishNow = mode === 'publish' && published;
      const normalizedSlug = normalizeSlug(slug);
      const normalizedYear = normalizePostYear(year);
      if (!normalizedYear) {
        throw new Error('연도(YYYY)를 입력하세요');
      }

      const payload: CreatePostPayload = {
        title: normalizeRequiredText(title, normalizedSlug || 'New Post'),
        slug: normalizedSlug || undefined,
        year: normalizedYear,
        content,
        draft: !publishNow,
        frontmatter: {
          category: normalizeRequiredText(category, 'General'),
          tags: normalizeTagList(tags),
          coverImage: normalizeCoverImageUrl(coverImage),
          published: publishNow,
        },
      };

      return createPostPR(payload);
    },
    onSuccess: data => {
      setSubmitOutcome(data.prUrl ? `PR 생성 확인: ${data.prUrl}` : data.outboxId ? `Outbox 등록 확인: ${data.outboxId}` : `작업 등록 확인: ${data.path || '응답에 경로 없음'}`);
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
      setSubmitOutcome('제출 결과를 확인하지 못했습니다. 중복 제출 전에 PR 또는 Outbox를 확인하세요. 입력은 그대로 남아 있습니다.');
      toast({
        title: 'PR 생성 실패',
        description: getErrorMessage(error, '오류'),
        variant: 'destructive',
      });
    },
    onSettled: () => { submitInFlight.current = false; },
  });

  const openSubmitReview = (mode: SubmitMode) => {
    if (createPr.isPending || submitInFlight.current) return;
    setSubmitFeedback('');
    setSubmitReview({ mode, snapshot: { ...currentDraft }, signature: editorReviewSignature(currentDraft) });
  };
  const submitReviewed = () => {
    if (!submitReview || createPr.isPending || submitInFlight.current) return;
    if (!isEditorReviewCurrent(submitReview.signature, currentDraft)) {
      setSubmitFeedback('검토 후 문서가 바뀌었습니다. 창을 닫고 변경된 내용으로 다시 검토하세요.');
      return;
    }
    if (!normalizePostYear(submitReview.snapshot.year)) {
      setSubmitFeedback('연도는 YYYY 형식으로 입력해야 합니다. 문서 정보에서 수정하세요.');
      return;
    }
    submitInFlight.current = true;
    const submission = { mode: submitReview.mode, snapshot: { ...submitReview.snapshot } };
    setSubmitReview(null);
    createPr.mutate(submission);
  };

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

      if (uploadInFlightRef.current) {
        toast({
          title: '이미지 업로드 진행 중',
          description: '진행 중인 업로드가 끝난 뒤 다시 시도하세요.',
        });
        return;
      }

      uploadInFlightRef.current = true;

      try {
        const normalizedYear = normalizePostYear(year);
        if (!normalizedYear) throw new Error('연도(YYYY)를 입력하세요');
        const normalizedSlug = normalizeSlug(slug);
        if (!normalizedSlug) {
          throw new Error('슬러그를 먼저 입력하세요. 이미지 저장 경로에 필요합니다.');
        }

        setIsUploading(true);
        setFailedUploadAttempt(null);
        const result = await uploadPostImages(
          { year: normalizedYear, slug: normalizedSlug },
          imageFiles,
        );

        const markdown = result.items
          .map((item, index) => {
            const url = getImageUrl(item);
            const original = imageFiles[index];
            return appendAttachedImage(
              url,
              original?.name || url.split('/').pop() || 'image',
              'upload',
            );
          })
          .join('\n');
        if (markdown) insertAtCursor(markdown);

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
        uploadInFlightRef.current = false;
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
    (markdown: string, imageUrl?: string) => {
      if (imageUrl) {
        appendAttachedImage(
          imageUrl,
          imageUrl.split('/').pop() || 'generated-image',
          'generated',
          markdown,
        );
      }
      insertAtCursor(markdown);
    },
    [appendAttachedImage, insertAtCursor],
  );

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: '복사 완료' });
    } catch {
      toast({
        title: 'URL 복사 실패',
        description: '클립보드에 접근할 수 없습니다. 브라우저 권한을 확인하세요.',
        variant: 'destructive',
      });
    }
  };

  const insertLink = () => {
    const url =
      typeof window !== 'undefined'
        ? window.prompt('URL', 'https://')
        : 'https://';
    if (!url) return;
    wrapSelection('[', `](${url})`);
  };

  const editorToolbar: { id: ActionIdOfKind<'command'>; run: () => void }[] = [
    { id: 'heading', run: () => insertAtCursor('## 섹션 제목\n\n') },
    { id: 'bold', run: () => wrapSelection('**') },
    { id: 'italic', run: () => wrapSelection('*') },
    { id: 'quote', run: () => insertAtCursor('> 인용문\n') },
    { id: 'list', run: () => insertAtCursor('- 항목\n') },
    { id: 'code', run: () => insertAtCursor('```ts\n// code\n```\n') },
    { id: 'link', run: insertLink },
  ];

  return (
    <div className="ui-editor fn-editor-workspace" data-ui-page='post-editor' data-editor-mode={editorMode} data-active-pane={mobilePane}>
      <section className="ui-editor-document">
        <header className="ui-editor-commandbar">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="ui-editor-title">
                게시글 작성
              </h2>
              <Badge variant='secondary' className="rounded-md">
                {published ? 'public' : 'draft'}
              </Badge>
              <Badge variant='outline' className="rounded-md font-mono">
                {year || 'YYYY'}/{slug || 'slug'}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-ui-muted dark:text-ui-muted">
              드래그 앤 드랍 이미지 첨부, 임시 저장, AI 작성 지원, 이미지 검토와 삽입을 한 화면에서 처리합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="ui-draft-status" role='status' aria-live='polite'>
              {draftStatus === 'error' ? '로컬 저장 확인 필요' : draftStatus === 'saving' ? '로컬 저장 중' : draftSavedAt ? `마지막 로컬 저장 · ${formatDraftTime(draftSavedAt)}` : '아직 로컬 저장되지 않음'}
            </span>
            <Button data-ui-variant='outline'
              type='button'
              variant='outline'
              size='sm'
              onClick={() => saveDraft(true)}
              className="ui-control min-h-9 rounded-lg"
            >
              <Save className="h-4 w-4" aria-hidden='true' />
              임시 저장
            </Button>
            <Button data-ui-variant='secondary'
              type='button'
              variant='secondary'
              size='sm'
              onClick={() => openSubmitReview('draft')}
              disabled={createPr.isPending}
              className="ui-control min-h-9 rounded-lg"
            >
              {createPr.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <FilePlus2 className="h-4 w-4" />
              )}
              Draft PR
            </Button>
            <Button data-ui-variant="default"
              type='button'
              size='sm'
              onClick={() => openSubmitReview('publish')}
              disabled={createPr.isPending}
              className="ui-control min-h-9 rounded-lg"
            >
              <Send className="h-4 w-4" aria-hidden='true' />
              제출 검토
            </Button>
            <Button data-ui-variant='ghost'
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => void logout()}
              className="ui-control min-h-9 rounded-lg text-ui-muted hover:text-red-600"
            >
              <LogOut className="h-4 w-4" aria-hidden='true' />
              로그아웃
            </Button>
          </div>
        </header>
        {draftError && <p className="ui-inline-error" role='alert'>{draftError}</p>}
        {(createPr.isPending || submitOutcome) && <p className="ui-inline-status" role='status' aria-live='polite'>
          {createPr.isPending ? '검토한 스냅샷을 제출하는 중입니다. 창을 닫아도 요청이 취소되지는 않습니다.' : submitOutcome}
        </p>}
        <PaneSwitcher label='글 편집 작업 영역' value={mobilePane} onChange={setMobilePane}
          options={[{id:'write',label:'작성',controls:'post-editor-write-pane'},
            {id:'preview',label:'미리보기',controls:'post-editor-preview-pane'},
            {id:'tools',label:'도구',controls:'post-editor-tools-pane'}]} />
        <div className="ui-editor-layout">
          <div className="ui-editor-main">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor='post-editor-title' className="ui-label text-xs">
                  제목
                </Label>
                <Input
                  id='post-editor-title'
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  placeholder='글 제목'
                  className="ui-input h-10 rounded-lg bg-ui-surface text-sm dark:bg-ui-surface"
                />
              </div>
            <details className="ui-editor-metadata">
              <summary>문서 정보 <span>{year || 'YYYY'}/{slug || 'slug'} · {published ? '공개 의도' : '비공개 의도'}</span></summary>
              <div className="ui-metadata-fields">
              <div className="space-y-1.5">
                <Label htmlFor='post-editor-slug' className="ui-label text-xs">
                  슬러그
                </Label>
                <div className="flex gap-2">
                  <Input
                    id='post-editor-slug'
                    value={slug}
                    onChange={event => {
                      setSlugTouched(true);
                      setSlug(normalizeSlug(event.target.value));
                    }}
                    placeholder='my-new-post'
                    className="ui-input h-10 rounded-lg bg-ui-surface font-mono text-sm dark:bg-ui-surface"
                  />
                  <Button data-ui-variant='outline'
                    type='button'
                    variant='outline'
                    size='icon'
                    onClick={() => {
                      setSlugTouched(true);
                      setSlug(normalizeSlug(title));
                    }}
                    aria-label='제목으로 슬러그 생성'
                    title='제목으로 슬러그 생성'
                    className="ui-control h-10 w-10 rounded-lg"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden='true' />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor='post-editor-year' className="ui-label text-xs">
                  연도
                </Label>
                <Input
                  id='post-editor-year'
                  value={year}
                  onChange={event => setYear(event.target.value)}
                  placeholder='2026'
                  className="ui-input h-10 rounded-lg bg-ui-surface font-mono text-sm dark:bg-ui-surface"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor='post-editor-category' className="ui-label text-xs">
                  카테고리
                </Label>
                <Input
                  id='post-editor-category'
                  value={category}
                  onChange={event => setCategory(event.target.value)}
                  placeholder='General'
                  className="ui-input h-10 rounded-lg bg-ui-surface text-sm dark:bg-ui-surface"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor='post-editor-tags' className="ui-label text-xs">
                  태그
                </Label>
                <Input
                  id='post-editor-tags'
                  value={tags}
                  onChange={event => setTags(event.target.value)}
                  placeholder='react, typescript'
                  className="ui-input h-10 rounded-lg bg-ui-surface text-sm dark:bg-ui-surface"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor='post-editor-cover' className="ui-label text-xs">
                  커버 이미지 URL
                </Label>
                <Input
                  id='post-editor-cover'
                  value={coverImage}
                  onChange={event => setCoverImage(event.target.value)}
                  placeholder='/images/cover.png'
                  className="ui-input h-10 rounded-lg bg-ui-surface font-mono text-sm dark:bg-ui-surface"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-ui-line bg-ui-surface px-3 py-2 dark:border-ui-line dark:bg-ui-surface md:col-span-2 xl:col-span-4">
                <div>
                  <Label htmlFor='post-editor-published' className="ui-label text-xs">
                    공개 상태
                  </Label>
                  <p className="text-xs text-ui-muted">
                    Draft PR은 이 값과 관계없이 draft로 생성됩니다.
                  </p>
                </div>
                <label className="inline-flex min-h-10 items-center gap-2 text-sm">
                  <input
                    id='post-editor-published'
                    type='checkbox'
                    checked={published}
                    onChange={event => setPublished(event.target.checked)}
                    className="h-4 w-4 rounded border-ui-line"
                  />
                  공개
                </label>
              </div>

              </div>
            </details>

            <section
              className={cn(
                "relative rounded-lg border border-ui-line bg-ui-surface dark:border-ui-line dark:bg-ui-surface",
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
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-blue-50/90 text-sm font-semibold text-blue-700 dark:bg-blue-950/80 dark:text-blue-200">
                  <UploadCloud className="mr-2 h-5 w-5" aria-hidden='true' />
                  이미지를 놓으면 본문에 첨부됩니다.
                </div>
              )}

              <div className="flex flex-col gap-3 border-b border-ui-line px-3 py-2 dark:border-ui-line md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <ActionToolbar label="본문 서식과 첨부" className="ui-editor-format-toolbar">
                    {editorToolbar.map(item => (
                      <ActionButton key={item.id} action={item.id} iconOnly onClick={item.run} />
                    ))}
                    <ActionButton action="attachImage" variant="outline"
                      onClick={() => fileInputRef.current?.click()} busy={isUploading} />
                  </ActionToolbar>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple hidden
                    aria-label="첨부할 이미지 선택" onChange={() => { void handleFileInputUpload(); }} />
                </div>

                <div className="ui-editor-desktop-modes">
                  <Tabs
                    value={editorMode}
                    onValueChange={value =>
                      setEditorMode(value as 'write' | 'preview' | 'split')
                    }
                  >
                    <TabsList className="ui-subtabs h-9 rounded-lg">
                      <TabsTrigger value='write' className="ui-subtab h-7 rounded-md text-xs">
                        Write
                      </TabsTrigger>
                      <TabsTrigger value='split' className="ui-subtab h-7 rounded-md text-xs">
                        Split
                      </TabsTrigger>
                      <TabsTrigger value='preview' className="ui-subtab h-7 rounded-md text-xs">
                        Preview
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              {failedUploadAttempt && (
                <div className="m-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  <div className="font-medium">업로드가 중단되었습니다.</div>
                  <div className="mt-1 text-xs">{failedUploadAttempt.message}</div>
                  <Button data-ui-variant='outline'
                    type='button'
                    size='sm'
                    variant='outline'
                    className="ui-control mt-2 min-h-9 rounded-lg"
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
                  'ui-editor-canvas',
                  editorMode === 'split' && 'lg:grid-cols-2',
                )}
              >
                <div className="ui-editor-write-pane" id='post-editor-write-pane' role='region' aria-label='본문 작성'>
                    <Textarea
                      ref={textareaRef}
                      aria-label='Markdown content editor'
                      value={content}
                      onChange={event => setContent(event.target.value)}
                      onPaste={event => {
                        void handlePaste(event);
                      }}
                      className="ui-textarea min-h-[560px] resize-y rounded-none border-0 bg-ui-surface font-mono text-sm leading-6 shadow-none focus-visible:ring-0 dark:bg-ui-surface"
                      placeholder='Markdown으로 본문을 작성하세요.'
                    />
                  </div>
                  <div className="ui-editor-preview-pane" id='post-editor-preview-pane' role='region' aria-label='본문 미리보기'>
                  <ScrollArea className="ui-editor-preview-scroll">
                    <div className="prose prose-zinc max-w-none p-5 dark:prose-invert">
                      <MarkdownRenderer
                        content={previewContent}
                        profile='preview'
                        postPath={previewPostPath}
                      />
                    </div>
                  </ScrollArea>
                  </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ui-line px-3 py-2 text-xs text-ui-muted dark:border-ui-line dark:text-ui-muted">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{stats.words} words</span>
                  <span>{stats.chars} chars</span>
                  <span>{stats.minutes} min</span>
                  <span>{stats.imageCount} images</span>
                </div>
                <div className="flex items-center gap-2">
                  {draftStatus === 'saved' && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden='true' />
                      saved
                    </span>
                  )}
                  <Button data-ui-variant='ghost'
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => setClearDraftOpen(true)}
                    className="ui-control h-8 rounded-lg px-2 text-xs"
                  >
                    임시 저장 삭제
                  </Button>
                </div>
              </div>
            </section>
          </div>

          <WorkspacePanel as="aside" className="ui-editor-tools" id="post-editor-tools-pane" title="작성 도구" headingLevel={3}>
            <Tabs defaultValue='assistant' className="ui-editor-tool-tabs rounded-lg border border-ui-line bg-ui-surface dark:border-ui-line dark:bg-ui-surface">
              <div className="flex items-center justify-between border-b border-ui-line px-3 py-2 dark:border-ui-line">
                <TabsList className="ui-subtabs h-9 rounded-lg">
                  <TabsTrigger value='assistant' className="ui-subtab h-7 rounded-md text-xs">
                    <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden='true' />
                    Assistant
                  </TabsTrigger>
                  <TabsTrigger value='images' className="ui-subtab h-7 rounded-md text-xs">
                    <ImageIcon className="mr-1 h-3.5 w-3.5" aria-hidden='true' />
                    Images
                  </TabsTrigger>
                  <TabsTrigger value='assets' className="ui-subtab h-7 rounded-md text-xs">
                    <PanelRight className="mr-1 h-3.5 w-3.5" aria-hidden='true' />
                    Assets
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent forceMount value='assistant' className="ui-editor-assistant-tab">
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
                  setCoverImage={value => setCoverImage(normalizeCoverImageUrl(value) || '')}
                  onInsertMarkdown={insertAtCursor}
                />
              </TabsContent>

              <TabsContent forceMount value='images' className="m-0 p-3">
                <AiImageGeneratorPanel
                  title={title}
                  category={category}
                  tags={tags}
                  content={content}
                  year={year}
                  slug={slug}
                  onInsertMarkdown={handleGeneratedMarkdownInsert}
                  onSetCoverImage={setCoverImage}
                />
              </TabsContent>

              <TabsContent forceMount value='assets' className="m-0">
                <div className="space-y-3 p-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-ui-text dark:text-ui-text">
                      첨부 이미지
                    </h2>
                    <Badge variant='outline' className="rounded-md">
                      {attachedImages.length}
                    </Badge>
                  </div>
                  {attachedImages.length === 0 ? (
                    <div className="flex min-h-44 items-center justify-center rounded-lg border border-dashed border-ui-line bg-ui-soft text-ui-muted dark:border-ui-line dark:bg-ui-canvas/40">
                      <ImageIcon className="h-8 w-8" aria-hidden='true' />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attachedImages.map(item => (
                        <div
                          key={item.id}
                          className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-lg border border-ui-line p-2 dark:border-ui-line"
                        >
                          <img
                            src={item.url}
                            alt=''
                            loading='lazy'
                            className="h-16 w-16 rounded-md border border-ui-line object-cover dark:border-ui-line"
                          />
                          <div className="min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-xs font-medium text-ui-text dark:text-ui-text">
                                {item.name}
                              </span>
                              <Badge variant='secondary' className="rounded-md text-[10px]">
                                {item.source}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              <Button data-ui-variant='secondary'
                                type='button'
                                size='sm'
                                variant='secondary'
                                className="ui-control h-8 rounded-lg px-2 text-xs"
                                onClick={() => insertAtCursor(item.markdown)}
                              >
                                삽입
                              </Button>
                              <Button data-ui-variant='outline'
                                type='button'
                                size='sm'
                                variant='outline'
                                className="ui-control h-8 rounded-lg px-2 text-xs"
                                onClick={() => setCoverImage(item.url)}
                              >
                                커버
                              </Button>
                              <Button data-ui-variant='ghost'
                                type='button'
                                size='sm'
                                variant='ghost'
                                className="ui-control h-8 rounded-lg px-2 text-xs"
                                aria-label={`${item.name} URL 복사`}
                                title={`${item.name} URL 복사`}
                                onClick={() => void copyText(item.url)}
                              >
                                <Copy className="h-3.5 w-3.5" aria-hidden='true' />
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
          </WorkspacePanel>
        </div>
      </section>
      <Dialog open={submitReview !== null} onOpenChange={open => { if (!open) setSubmitReview(null); }}>
        <DialogContent className="ui-dialog ui-submit-review">
          <DialogHeader><DialogTitle>제출 전 검토</DialogTitle>
            <DialogDescription>브라우저 로컬 저장과 PR 생성은 다른 작업입니다. 아래 내용으로 요청하며, PR 생성만으로 게시가 완료되지는 않습니다.</DialogDescription></DialogHeader>
          {submitReview && <>
            <dl className="ui-review-fields">
              <dt>제목</dt><dd>{submitReview.snapshot.title || '(제목 없음)'}</dd>
              <dt>파일 경로</dt><dd>{submitReview.snapshot.year}/{normalizeSlug(submitReview.snapshot.slug) || '(자동 결정)'}</dd>
              <dt>공개 의도</dt><dd>{submitReview.mode === 'publish' && submitReview.snapshot.published ? '공개 PR' : '초안 PR'}</dd>
              <dt>카테고리 · 태그</dt><dd>{submitReview.snapshot.category} · {submitReview.snapshot.tags || '없음'}</dd>
              <dt>커버 이미지</dt><dd>{submitReview.snapshot.coverImage || '없음'}</dd>
            </dl>
            <details><summary>제출할 본문 확인 · {submitReview.snapshot.content.length}자</summary><pre className="ui-review-source">{submitReview.snapshot.content}</pre></details>
            {!isEditorReviewCurrent(submitReview.signature, currentDraft) && <p role='alert' className="ui-inline-error">검토 후 내용이 변경되어 제출을 보류했습니다. 다시 검토하세요.</p>}
          </>}
          {submitFeedback && <p className="ui-inline-error" role='alert'>{submitFeedback}</p>}
          <DialogFooter><Button className="ui-control" data-ui-variant='outline' type='button' variant='outline' onClick={() => setSubmitReview(null)}>편집으로 돌아가기</Button>
            <Button className="ui-control" data-ui-variant="default" type='button' onClick={submitReviewed} disabled={!submitReview || createPr.isPending || !isEditorReviewCurrent(submitReview.signature, currentDraft)}>확인한 내용으로 PR 요청</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={clearDraftOpen} onOpenChange={setClearDraftOpen}>
        <DialogContent className="ui-dialog"><DialogHeader><DialogTitle>로컬 저장본을 삭제할까요?</DialogTitle>
          <DialogDescription>브라우저에 저장된 임시 저장본만 삭제합니다. 현재 편집 중인 내용과 서버의 게시글은 삭제하지 않습니다. 이후 편집하면 자동 저장이 다시 동작합니다.</DialogDescription></DialogHeader>
          {draftError && <p className="ui-inline-error" role="alert">{draftError}</p>}
          <DialogFooter><Button className="ui-control" data-ui-variant='outline' type='button' variant='outline' onClick={() => setClearDraftOpen(false)}>취소</Button><Button className="ui-control" data-ui-variant='destructive' type='button' variant='destructive' onClick={clearDraft}>로컬 저장본 삭제</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
