import type { ZodTypeAny } from 'zod';

export type TranslationErrorCode =
  | 'AUTH_REQUIRED'
  | 'NOT_READY'
  | 'NOT_AVAILABLE'
  | 'AI_TIMEOUT'
  | 'AI_ERROR'
  | 'BACKEND_UNAVAILABLE'
  | 'UNKNOWN';

export type TranslationLocale = 'ko' | 'en';

export type LocalizedPostFields = {
  title: string;
  description?: string | null;
  excerpt?: string | null;
  content: string;
  language?: TranslationLocale;
  sourceLanguage?: TranslationLocale;
  contentHash?: string;
  translatedAt?: string;
};

export type TranslationResult = LocalizedPostFields & {
  cached?: boolean;
  isAiGenerated?: boolean;
  stale?: boolean;
  warming?: boolean;
};

export type TranslationQuery = {
  year: string;
  slug: string;
  targetLang: TranslationLocale;
};

export type TranslationGenerateInput = TranslationQuery & {
  sourceLang?: TranslationLocale;
  title: string;
  description?: string;
  excerpt?: string;
  content: string;
  forceRefresh?: boolean;
};

export type TranslationJobStatus = {
  id: string;
  type: 'translation.generate';
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  message?: string;
  resultRef?: string;
  statusUrl?: string;
  cacheUrl?: string;
  generateUrl?: string;
  contentHash?: string;
  createdAt: string;
  updatedAt: string;
};

export const translationErrorCodeSchema: ZodTypeAny;
export const translationLocaleSchema: ZodTypeAny;
export const localizedPostFieldsSchema: ZodTypeAny;
export const translationResultSchema: ZodTypeAny;
export const translationQuerySchema: ZodTypeAny;
export const translationGenerateSchema: ZodTypeAny;
export const translationJobStatusSchema: ZodTypeAny;
export const cachedTranslationResponseSchema: ZodTypeAny;
export const translationGenerateResponseSchema: ZodTypeAny;
export const translationJobResponseSchema: ZodTypeAny;
