/**
 * Translation Service
 * Handles AI-powered translations with caching
 */
import {
  cachedTranslationResponseSchema,
  translationGenerateResponseSchema,
} from "@blog/shared/contracts/translation";
import { getApiBaseUrl } from "@/utils/network/apiBase";
import { getAuthHeadersAsync } from "@/stores/session/useAuthStore";

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
  title?: string;
  description?: string;
  content?: string;
  forceRefresh?: boolean;
};

export type TranslationErrorCode =
  | "AI_ERROR"
  | "AI_TIMEOUT"
  | "AUTH_REQUIRED"
  | "NOT_AVAILABLE"
  | "UNKNOWN";

type TranslationErrorResponse = {
  error?: string | { message?: string };
  code?: string;
  retryable?: boolean;
  message?: string;
};

export class TranslationApiError extends Error {
  code: TranslationErrorCode;
  status: number;
  retryable: boolean;

  constructor(
    message: string,
    options: {
      code?: TranslationErrorCode;
      status: number;
      retryable?: boolean;
    },
  ) {
    super(message);
    this.name = "TranslationApiError";
    this.code = options.code ?? "UNKNOWN";
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

function mapStatusToErrorCode(
  status: number,
  data?: TranslationErrorResponse,
): TranslationErrorCode {
  if (data?.code === "AI_TIMEOUT" || status === 504) return "AI_TIMEOUT";
  if (data?.code === "AI_ERROR" || status === 502) return "AI_ERROR";
  if (data?.code === "NOT_AVAILABLE" || status === 404) return "NOT_AVAILABLE";
  if (status === 401 || status === 403) return "AUTH_REQUIRED";
  return "UNKNOWN";
}

async function parseError(response: Response): Promise<TranslationApiError> {
  const data = (await response
    .json()
    .catch(() => ({}))) as TranslationErrorResponse;
  const message =
    (typeof data.error === "string" ? data.error : data.error?.message) ||
    data.message ||
    `Translation failed: ${response.status}`;

  return new TranslationApiError(message, {
    code: mapStatusToErrorCode(response.status, data),
    status: response.status,
    retryable: Boolean(
      data.retryable || response.status === 502 || response.status === 504,
    ),
  });
}

function parseTranslationPayload(
  payload: unknown,
  status: number,
): TranslationResult {
  const parsed = translationGenerateResponseSchema.safeParse(payload);
  if (parsed.success) {
    const data = parsed.data.data;
    if ("translation" in data) {
      if (data.translation) {
        return data.translation as TranslationResult;
      }

      throw new TranslationApiError("Translation is not ready yet", {
        code: "NOT_AVAILABLE",
        status,
      });
    }

    return data as TranslationResult;
  }

  const cached = cachedTranslationResponseSchema.safeParse(payload);
  if (cached.success) {
    return cached.data.data as TranslationResult;
  }

  throw new TranslationApiError("Invalid translation response", {
    code: "UNKNOWN",
    status,
  });
}

// ============================================================================
// API Functions
// ============================================================================

type FetchTranslationOptions = {
  method?: "GET" | "POST" | "DELETE";
  headers?: HeadersInit;
  body?: string;
};

async function fetchWithFallback(
  urls: string[],
  options: FetchTranslationOptions = {},
): Promise<Response> {
  let lastResponse: Response | null = null;
  let lastError: unknown;

  for (const url of urls) {
    try {
      const response = await fetch(url, options);
      if (response.status !== 404) {
        return response;
      }
      lastResponse = response;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError ?? new Error("Translation request failed");
}

/**
 * Generate a translation for a published blog post.
 * The preferred contract lets the server load the post by year/slug.
 * Legacy payload fields are still accepted for older servers.
 */
export async function translatePost(
  request: TranslationRequest,
): Promise<TranslationResult> {
  const baseUrl = getApiBaseUrl();
  const headers = await getAuthHeadersAsync();
  const body = JSON.stringify({
    sourceLang: request.sourceLang,
    forceRefresh: request.forceRefresh,
  });

  console.log(
    "[translate] Requesting translation:",
    request.year,
    request.slug,
    request.targetLang,
  );

  const response = await fetch(
    `${baseUrl}/api/v1/internal/posts/${request.year}/${request.slug}/translations/${request.targetLang}/generate`,
    {
      method: "POST",
      headers,
      body,
    },
  );

  if (!response.ok) {
    const error = await parseError(response);
    console.error(
      "[translate] API error:",
      response.status,
      error.message,
      error.code,
    );
    throw error;
  }

  const payload = await response.json().catch(() => null);
  const data = parseTranslationPayload(payload, response.status);
  console.log("[translate] Success, cached:", data.cached);
  return data;
}

/**
 * Get cached translation for a post (if exists)
 */
export async function getCachedTranslation(
  year: string,
  slug: string,
  targetLang: string,
): Promise<TranslationResult | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetchWithFallback([
      `${baseUrl}/api/v1/public/posts/${year}/${slug}/translations/${targetLang}`,
      `${baseUrl}/api/v1/translate/${year}/${slug}/${targetLang}`,
    ]);

    if (!response.ok) {
      if (response.status === 404) return null;
      return null;
    }

    const payload = await response.json().catch(() => null);
    return parseTranslationPayload(payload, response.status);
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
  targetLang: string,
): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    const headers = await getAuthHeadersAsync();
    const response = await fetchWithFallback(
      [
        `${baseUrl}/api/v1/internal/posts/${year}/${slug}/translations/${targetLang}`,
        `${baseUrl}/api/v1/translate/${year}/${slug}/${targetLang}`,
      ],
      {
        method: "DELETE",
        headers,
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}
