import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/ui/use-toast';
import {
  generatePostImages,
  type AdminAiImageQuality,
  type AdminAiImageSize,
  type GeneratedPostImageItem,
} from '@/services/session/adminImages';
import { cn } from '@/lib/utils';
import { buildFinalImagePrompt, buildSuggestedPrompt } from './aiImagePrompt';

const IMAGE_SIZES: Array<{ value: AdminAiImageSize; label: string }> = [
  { value: '1024x1024', label: '1:1 square' },
  { value: '1536x1024', label: '3:2 wide' },
  { value: '1024x1536', label: '2:3 tall' },
  { value: '1792x1024', label: '16:9 wide' },
  { value: '1024x1792', label: '9:16 tall' },
];

const IMAGE_QUALITIES: Array<{ value: AdminAiImageQuality; label: string }> = [
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
  { value: 'auto', label: 'Auto' },
];

type AiImageGeneratorPanelProps = {
  title: string;
  category: string;
  tags: string;
  content: string;
  year: string;
  slug: string;
  onInsertMarkdown: (markdown: string) => void;
  onSetCoverImage: (url: string) => void;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const GENERATED_IMAGE_URL_CONTROL_PATTERN = /[\u0000-\u001F\u007F\\]/;
const GENERATED_IMAGE_URL_ENCODED_UNSAFE_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f|2f|5c)/i;

function normalizeGeneratedImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (
    !trimmed ||
    GENERATED_IMAGE_URL_CONTROL_PATTERN.test(trimmed) ||
    GENERATED_IMAGE_URL_ENCODED_UNSAFE_PATTERN.test(trimmed)
  ) {
    return null;
  }

  try {
    decodeURI(trimmed);
  } catch {
    return null;
  }

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.username &&
      !parsed.password
    ) {
      return parsed.href;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeImageAlt(value: unknown): string {
  const normalized = typeof value === 'string'
    ? value.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
  return normalized || 'generated image';
}

function getImageUrl(item: GeneratedPostImageItem): string | null {
  return normalizeGeneratedImageUrl(item.variantWebp?.url || item.url);
}

function buildGeneratedImageMarkdown(item: GeneratedPostImageItem, imageUrl: string): string {
  return `![${normalizeImageAlt(item.alt)}](${imageUrl})`;
}

export default function AiImageGeneratorPanel({
  title,
  category,
  tags,
  content,
  year,
  slug,
  onInsertMarkdown,
  onSetCoverImage,
}: AiImageGeneratorPanelProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [alt, setAlt] = useState('');
  const [count, setCount] = useState('1');
  const [size, setSize] = useState<AdminAiImageSize>('1024x1024');
  const [quality, setQuality] = useState<AdminAiImageQuality>('medium');
  const [items, setItems] = useState<GeneratedPostImageItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const suggestedPrompt = useMemo(
    () => buildSuggestedPrompt({ title, category, tags, content }),
    [title, category, tags, content],
  );
  const generateBlockReason = useMemo(() => {
    if (!/^[0-9]{4}$/.test(year)) {
      return '연도(YYYY)를 입력하면 이미지 생성이 가능합니다.';
    }
    if (!slug.trim()) {
      return '슬러그(slug)를 입력하면 이미지 저장 경로를 만들 수 있습니다.';
    }
    return null;
  }, [slug, year]);
  const canGenerate = !generateBlockReason && !isGenerating;

  const handleGenerate = async () => {
    try {
      if (!/^[0-9]{4}$/.test(year)) throw new Error('연도(YYYY)를 입력하세요');
      if (!slug.trim()) throw new Error('슬러그(slug)를 먼저 입력하세요');

      setIsGenerating(true);
      setErrorMessage(null);
      const response = await generatePostImages(
        {
          year,
          slug: slug.trim(),
          prompt: buildFinalImagePrompt(prompt, suggestedPrompt),
          n: Number.parseInt(count, 10),
          size,
          quality,
          outputFormat: 'png',
          alt: alt.trim() || title.trim() || `${slug.trim()} cover image`,
        },
      );
      setItems((previous) => [...response.items, ...previous]);
      toast({
        title: '이미지 생성 완료',
        description: `${response.items.length}개 생성됨`,
      });
    } catch (error) {
      const message = getErrorMessage(error, '이미지 생성 실패');
      setErrorMessage(message);
      toast({
        title: '이미지 생성 실패',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    window.setTimeout(() => setCopiedUrl(null), 1400);
  };

  return (
    <section className="rounded-md border border-border bg-card/60 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="text-base font-semibold">AI 이미지 생성</h2>
            <Badge variant="secondary" className="rounded-md">
              Beta
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            제목, 카테고리, 태그, 본문을 바탕으로 게시글 이미지를 생성합니다.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPrompt(suggestedPrompt)}
          className="min-h-9 shrink-0"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          프롬프트 채우기
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="ai-image-prompt">프롬프트</Label>
            <Textarea
              id="ai-image-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-h-28 resize-y"
              maxLength={4000}
              placeholder={suggestedPrompt}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-image-alt">대체 텍스트</Label>
              <Input
                id="ai-image-alt"
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                maxLength={180}
                placeholder={title.trim() || 'AI generated image'}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>개수</Label>
                <Select value={count} onValueChange={setCount}>
                  <SelectTrigger aria-label="생성 개수">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>크기</Label>
                <Select
                  value={size}
                  onValueChange={(value) => setSize(value as AdminAiImageSize)}
                >
                  <SelectTrigger aria-label="이미지 크기">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_SIZES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>품질</Label>
                <Select
                  value={quality}
                  onValueChange={(value) => setQuality(value as AdminAiImageQuality)}
                >
                  <SelectTrigger aria-label="이미지 품질">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_QUALITIES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {errorMessage && (
            <div className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
          {generateBlockReason && !isGenerating && (
            <div
              id="ai-image-generate-disabled-reason"
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"
            >
              {generateBlockReason}
            </div>
          )}
          <Button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={!canGenerate}
            aria-describedby={
              generateBlockReason && !isGenerating
                ? 'ai-image-generate-disabled-reason'
                : undefined
            }
            className="min-h-11 w-full sm:w-auto"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
            )}
            {isGenerating ? '생성 중...' : '이미지 생성'}
          </Button>
        </div>

        <div className="rounded-md border border-border bg-background p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">생성 결과</span>
            <span className="text-xs text-muted-foreground">{items.length}개</span>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
            {isGenerating && (
              <div className="aspect-square animate-pulse rounded-md border border-dashed bg-muted motion-reduce:animate-none" />
            )}
            {!isGenerating && items.length === 0 && (
              <div className="col-span-full flex aspect-square items-center justify-center rounded-md border border-dashed bg-muted/30 text-muted-foreground">
                <ImageIcon className="h-8 w-8" aria-hidden="true" />
              </div>
            )}
            {items.map((item) => {
              const imageUrl = getImageUrl(item);
              if (!imageUrl) return null;
              const imageAlt = normalizeImageAlt(item.alt);
              const markdown = buildGeneratedImageMarkdown(item, imageUrl);
              const copied = copiedUrl === imageUrl;
              return (
                <div key={item.path} className="space-y-2">
                  <button
                    type="button"
                    className={cn(
                      'group relative block aspect-square w-full overflow-hidden rounded-md border bg-muted text-left',
                      'transition-transform duration-200 ease-spring hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100',
                    )}
                    onClick={() => onInsertMarkdown(markdown)}
                    aria-label={`본문에 ${imageAlt} 삽입`}
                    title={`본문에 ${imageAlt} 삽입`}
                  >
                    <img
                      src={imageUrl}
                      alt={imageAlt}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-background/90 px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                      본문에 삽입
                    </span>
                  </button>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="min-h-9 px-2 text-xs"
                      onClick={() => onInsertMarkdown(markdown)}
                    >
                      삽입
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-9 px-2 text-xs"
                      onClick={() => onSetCoverImage(imageUrl)}
                    >
                      커버
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-9 px-2 text-xs"
                      onClick={() => void copyUrl(imageUrl)}
                      aria-label={`${item.alt} URL 복사`}
                      title={`${item.alt} URL 복사`}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
