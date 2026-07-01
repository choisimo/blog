import type { SiteContentBlock } from '@/services/content/site-content';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, FileText, Megaphone, RefreshCw, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { AdminSubtabs, type AdminSubtabsTab } from '@/components/molecules/AdminSubtabs';
import { SafeDescriptionMarkdown } from '@/components/features/blog/SafeDescriptionMarkdown';
import { PostEditorWorkspace } from '@/components/features/admin/content/PostEditorWorkspace';
import {
  DEFAULT_HOME_AI_CTA_BLOCK,
  getAdminSiteContentBlock,
  HOME_AI_CTA_BLOCK_KEY,
  saveSiteContentBlock,
  type SiteContentBlockDraft,
} from '@/services/content/site-content';

type ContentSubtab = 'editor' | 'home-cta';

const CONTENT_SUBTABS: AdminSubtabsTab[] = [
  {
    id: 'editor',
    label: 'Post Editor',
    icon: <FileText className='h-3.5 w-3.5' />,
  },
  {
    id: 'home-cta',
    label: 'Home CTA',
    icon: <Megaphone className='h-3.5 w-3.5' />,
  },
];

export interface ContentManagerProps {
  initialHomeCtaBlock?: SiteContentBlock | null;
  subtab?: string;
  onSubtabChange?: (subtab: ContentSubtab) => void;
}

export function ContentManager({
  initialHomeCtaBlock = null,
  subtab,
  onSubtabChange,
}: ContentManagerProps = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [localSubtab, setLocalSubtab] = useState<ContentSubtab>('editor');
  const [markdown, setMarkdown] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaHref, setCtaHref] = useState('');
  const [enabled, setEnabled] = useState(true);

  const activeSubtab: ContentSubtab =
    subtab === 'home-cta' || subtab === 'editor' ? subtab : localSubtab;
  const setActiveSubtab = (nextSubtab: ContentSubtab) => {
    setLocalSubtab(nextSubtab);
    onSubtabChange?.(nextSubtab);
  };

  const query = useQuery({
    queryKey: ['site-content', HOME_AI_CTA_BLOCK_KEY],
    queryFn: () => getAdminSiteContentBlock(HOME_AI_CTA_BLOCK_KEY),
    initialData: initialHomeCtaBlock ?? undefined,
  });

  const block = query.data ?? DEFAULT_HOME_AI_CTA_BLOCK;
  const homeCtaLoadError = query.error instanceof Error ? query.error : null;
  const hasLoadedHomeCta = query.data !== undefined;
  const homeCtaUnavailable = Boolean(homeCtaLoadError && !hasLoadedHomeCta);
  const homeCtaFormDisabled =
    homeCtaUnavailable || (query.isLoading && !hasLoadedHomeCta);

  useEffect(() => {
    setMarkdown(block.markdown);
    setCtaLabel(block.ctaLabel ?? '');
    setCtaHref(block.ctaHref ?? '');
    setEnabled(block.enabled);
  }, [block]);

  const saveMutation = useMutation({
    mutationFn: (draft: SiteContentBlockDraft) =>
      saveSiteContentBlock(HOME_AI_CTA_BLOCK_KEY, draft),
    onSuccess: saved => {
      queryClient.setQueryData(['site-content', HOME_AI_CTA_BLOCK_KEY], saved);
      toast({ title: 'Saved', description: 'Home CTA content updated.' });
    },
    onError: (err: Error) => {
      toast({
        title: 'Save failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (homeCtaFormDisabled) return;
    saveMutation.mutate({
      markdown,
      ctaLabel: ctaLabel || null,
      ctaHref: ctaHref || null,
      enabled,
    });
  };

  return (
    <div className='space-y-4'>
      <section className='overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'>
        <AdminSubtabs
          tabs={CONTENT_SUBTABS}
          activeTab={activeSubtab}
          onTabChange={setActiveSubtab}
          className='bg-white dark:bg-zinc-900'
        />
      </section>

      {activeSubtab === 'editor' ? (
        <PostEditorWorkspace />
      ) : (
        <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]'>
          <section className='rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'>
        <div className='flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800'>
          <div>
            <h2 className='text-sm font-semibold text-zinc-800 dark:text-zinc-100'>
              Home AI CTA
            </h2>
            <p className='mt-0.5 text-xs text-zinc-400'>
              block: {HOME_AI_CTA_BLOCK_KEY}
            </p>
          </div>
          <button
            type='button'
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            className='flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
            aria-label='Refresh content'
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        <div className='space-y-4 p-4'>
          {homeCtaLoadError && (
            <div className='rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300'>
              <div className='flex items-start justify-between gap-3'>
                <div className='flex min-w-0 items-start gap-2'>
                  <AlertCircle className='mt-0.5 h-3.5 w-3.5 shrink-0' />
                  <div className='min-w-0'>
                    <p className='font-medium'>Unable to load Home CTA</p>
                    <p className='mt-1'>{homeCtaLoadError.message}</p>
                  </div>
                </div>
                <button
                  type='button'
                  onClick={() => void query.refetch()}
                  disabled={query.isFetching}
                  className='inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-amber-200 bg-white px-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40'
                >
                  <RefreshCw
                    className={`h-3 w-3 ${query.isFetching ? 'animate-spin' : ''}`}
                  />
                  Retry
                </button>
              </div>
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='home-ai-cta-markdown' className='text-xs'>
              Markdown
            </Label>
            <Textarea
              id='home-ai-cta-markdown'
              value={markdown}
              onChange={event => setMarkdown(event.target.value)}
              rows={12}
              disabled={homeCtaFormDisabled}
              className='min-h-72 resize-y rounded-lg font-mono text-sm'
            />
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='home-ai-cta-label' className='text-xs'>
                CTA label
              </Label>
              <Input
                id='home-ai-cta-label'
                value={ctaLabel}
                onChange={event => setCtaLabel(event.target.value)}
                disabled={homeCtaFormDisabled}
                className='h-9 rounded-lg text-sm'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='home-ai-cta-href' className='text-xs'>
                CTA href
              </Label>
              <Input
                id='home-ai-cta-href'
                value={ctaHref}
                onChange={event => setCtaHref(event.target.value)}
                disabled={homeCtaFormDisabled}
                className='h-9 rounded-lg font-mono text-sm'
              />
            </div>
          </div>

          <div className='flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800'>
            <div>
              <Label htmlFor='home-ai-cta-enabled' className='text-xs'>
                Enabled
              </Label>
              <p className='text-xs text-zinc-400'>Show this block on home.</p>
            </div>
            <Switch
              id='home-ai-cta-enabled'
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={homeCtaFormDisabled}
            />
          </div>

          <button
            type='button'
            onClick={handleSave}
            disabled={homeCtaFormDisabled || saveMutation.isPending}
            className='inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
          >
            <Save className='h-3.5 w-3.5' />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </section>

      <aside className='rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900'>
        <div className='mb-3 flex items-center justify-between'>
          <h3 className='text-sm font-semibold text-zinc-800 dark:text-zinc-100'>
            Preview
          </h3>
          <span className='rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800'>
            {enabled ? 'enabled' : 'hidden'}
          </span>
        </div>
        <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950'>
          <SafeDescriptionMarkdown
            text={markdown}
            className='text-sm leading-7 text-zinc-600 dark:text-zinc-300'
          />
          {ctaLabel && ctaHref && (
            <div className='mt-4 inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white'>
              {ctaLabel}
            </div>
          )}
        </div>
        {block.updatedAt && (
          <p className='mt-3 text-xs text-zinc-400'>
            Last updated:{' '}
            <span className='font-mono'>
              {new Date(block.updatedAt).toLocaleString()}
            </span>
          </p>
        )}
          </aside>
        </div>
      )}
    </div>
  );
}
