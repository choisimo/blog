/**
 * Translation Service
 * Handles AI-powered translations with caching
 */
import { getApiBaseUrl } from '@/utils/apiBase';

// ============================================================================
// Types
// ============================================================================

export type TranslationResult = {
  title: string;
  description: string;
  content: string;
  cached: boolean;
  isAiGenerated?: boolean;
};

export type TranslationRequest = {
  year: string;
  slug: string;
  targetLang: string;
  sourceLang?: string;
  title: string;
  description?: string;
  content: string;
  forceRefresh?: boolean;
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Translate a blog post to target language
 * First checks cache, then uses AI if not cached
 */
export async function translatePost(request: TranslationRequest): Promise<TranslationResult> {
  const baseUrl = getApiBaseUrl();
  
  console.log('[translate] Requesting translation:', request.year, request.slug, request.targetLang);
  
  const response = await fetch(`${baseUrl}/api/v1/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = (errorData as any)?.error?.message || `Translation failed: ${response.status}`;
    console.error('[translate] API error:', response.status, message);
    throw new Error(message);
  }

  const data = await response.json();
  console.log('[translate] Success, cached:', (data as any).data?.cached);
  return (data as any).data as TranslationResult;
}

/**
 * Get cached translation for a post (if exists)
 */
export async function getCachedTranslation(
  year: string,
  slug: string,
  targetLang: string
): Promise<TranslationResult | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/translate/${year}/${slug}/${targetLang}`);

    if (!response.ok) {
      if (response.status === 404) return null;
      return null;
    }

    const data = await response.json();
    return (data as any).data as TranslationResult;
  } catch {
    return null;
  }
}

/**
 * Delete cached translation
 */
export async function deleteCachedTranslation(
  year: string,
  slug: string,
  targetLang: string
): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/translate/${year}/${slug}/${targetLang}`, {
      method: 'DELETE',
    });

    return response.ok;
  } catch {
    return false;
  }
}
