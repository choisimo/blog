import type { SiteContentBlock } from '@/services/content/site-content';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { SafeDescriptionMarkdown } from '@/components/features/blog/SafeDescriptionMarkdown';
import {
  DEFAULT_HOME_AI_CTA_BLOCK,
  getAdminSiteContentBlock,
  HOME_AI_CTA_BLOCK_KEY,
  saveSiteContentBlock,
  type SiteContentBlockDraft,
} from '@/services/content/site-content';

export interface ContentManagerProps {
  initialHomeCtaBlock?: SiteContentBlock | null;
}

export function ContentManager({
  initialHomeCtaBlock = null,
}: ContentManagerProps = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [markdown, setMarkdown] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaHref, setCtaHref] = useState('');
  const [enabled, setEnabled] = useState(true);

  const query = useQuery({
    queryKey: ['site-content', HOME_AI_CTA_BLOCK_KEY],
    queryFn: () => getAdminSiteContentBlock(HOME_AI_CTA_BLOCK_KEY),
    initialData: initialHomeCtaBlock ?? undefined,
  });

  const block = query.data ?? DEFAULT_HOME_AI_CTA_BLOCK;

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
    saveMutation.mutate({
      markdown,
      ctaLabel: ctaLabel || null,
      ctaHref: ctaHref || null,
      enabled,
    });
  };

  return (
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
          {query.error instanceof Error && (
            <div className='rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300'>
              {query.error.message}
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
            />
          </div>

          <button
            type='button'
            onClick={handleSave}
            disabled={saveMutation.isPending}
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
  );
}
