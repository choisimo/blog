export function normalizeTranslationSlug(value: unknown, decode?: boolean): string;
export function normalizeTranslationSelectors(input: { year: string; slug: string; targetLang: string }, decode?: boolean): { year: string; slug: string; targetLang: 'ko' | 'en' };
export function translationUrls(origin: string, input: { year: string; slug: string; targetLang: string }, mode?: 'public' | 'internal'): { cacheUrl: string; statusUrl: string; generateUrl: string };
export function normalizeTranslationJobId(value: unknown): string;
