import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeTranslation, type TranslationObservation } from '@/services/content/translationObservation';
import { TranslationApiError, type PublicTranslationLookupResult, type TranslationJobStatus } from '@/services/content/translate';

const job = (status: TranslationJobStatus['status']): TranslationJobStatus => ({
  id: 'job-1', status, statusUrl: '/status', cacheUrl: '/cache', generateUrl: '/generate',
});
const translation = { title: 'Generated title', description: 'Generated description', content: '# Generated body', cached: true };
afterEach(() => vi.useRealTimers());

describe('translation observation recovery', () => {
  it('reports an empty admission as retryable instead of silently returning to idle', async () => {
    const events: TranslationObservation[] = [];
    await observeTranslation({
      signal: new AbortController().signal,
      lookup: async () => ({ translation: null, pending: false, job: null }),
      status: async () => job('queued'), onChange: value => events.push(value),
    });
    expect(events.at(-1)).toMatchObject({ status: 'error', error: { code: 'NOT_AVAILABLE', retryable: true } });
  });

  it('exposes server admission errors and preserves their retry policy', async () => {
    const events: TranslationObservation[] = [];
    await observeTranslation({
      signal: new AbortController().signal,
      lookup: async () => { throw new TranslationApiError('Service unavailable', { status: 503, code: 'BACKEND_UNAVAILABLE', retryable: true }); },
      status: async () => job('queued'), onChange: value => events.push(value),
    });
    expect(events.at(-1)).toMatchObject({ status: 'error', error: { code: 'BACKEND_UNAVAILABLE', retryable: true } });
  });

  it('recovers an expired saved job with one fresh admission', async () => {
    const lookup = vi.fn(async (): Promise<PublicTranslationLookupResult> => ({ translation, pending: false, job: null }));
    const events: TranslationObservation[] = [];
    await observeTranslation({
      signal: new AbortController().signal, resumeJobId: 'expired', lookup,
      status: async () => { throw new TranslationApiError('Job not found', { status: 404 }); },
      onChange: value => events.push(value),
    });
    expect(lookup).toHaveBeenCalledExactlyOnceWith({ signal: expect.any(AbortSignal) });
    expect(events.at(-1)).toEqual({ status: 'ready', translation });
  });

  it('does not create work when a saved job status is inaccessible', async () => {
    const lookup = vi.fn();
    const events: TranslationObservation[] = [];
    await observeTranslation({
      signal: new AbortController().signal, resumeJobId: 'job-1', lookup,
      status: async () => { throw new TranslationApiError('Forbidden', { status: 403, code: 'AUTH_REQUIRED' }); },
      onChange: value => events.push(value),
    });
    expect(lookup).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({ status: 'error', error: { code: 'AUTH_REQUIRED', retryable: false } });
  });

  it('keeps observing beyond forty polls and fetches the completed result read-only', async () => {
    vi.useFakeTimers();
    let polls = 0;
    const events: TranslationObservation[] = [];
    const lookup = vi.fn(async (options: { readOnly?: boolean }): Promise<PublicTranslationLookupResult> =>
      options.readOnly ? { translation, pending: false, job: null } : { translation: null, pending: true, job: job('queued') });
    const completed = observeTranslation({
      signal: new AbortController().signal, budgetMs: 300_000, lookup,
      status: async () => job(++polls > 40 ? 'succeeded' : 'running'), onChange: value => events.push(value),
    });
    await vi.advanceTimersByTimeAsync(123_000);
    await completed;
    expect(polls).toBe(41);
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup).toHaveBeenLastCalledWith({ signal: expect.any(AbortSignal), readOnly: true, jobId: 'job-1' });
    expect(events.at(-1)).toMatchObject({ status: 'ready', translation });
    expect(vi.getTimerCount()).toBe(0);
  });
});
