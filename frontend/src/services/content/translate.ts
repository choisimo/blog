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

export type TranslationJobStatus = {
  id: string;
  type: "translation.generate";
  status: "running" | "succeeded" | "failed";
  statusUrl: string;
  cacheUrl: string;
  generateUrl: string;
  error?: {
    code?: string;
    message: string;
    retryable?: boolean;
    retryAfterSeconds?: number;
  };
};

export type TranslationGenerateResult = {
  translation: TranslationResult | null;
  job: TranslationJobStatus | null;
  accepted: boolean;
};

export type PublicTranslationLookupResult = {
  translation: TranslationResult | null;
  pending: boolean;
  job: TranslationJobStatus | null;
  retryAfterSeconds?: number;
  warming?: boolean;
  stale?: boolean;
};

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

export function normalizeTranslationErrorCode(
  code?: string | null,
): TranslationErrorCode {
  if (code === "AI_TIMEOUT") return "AI_TIMEOUT";
  if (code === "AI_ERROR") return "AI_ERROR";
  if (code === "NOT_AVAILABLE" || code === "NOT_READY") return "NOT_AVAILABLE";
  if (code === "AUTH_REQUIRED") return "AUTH_REQUIRED";
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

function parseGenerateResult(
  payload: unknown,
  status: number,
): TranslationGenerateResult {
  const parsed = translationGenerateResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new TranslationApiError("Invalid translation response", {
      code: "UNKNOWN",
      status,
    });
  }

  const body = parsed.data;
  if ("job" in body && body.data === null) {
    return {
      translation: null,
      job: body.job as TranslationJobStatus,
      accepted: true,
    };
  }

  if ("job" in body.data) {
    return {
      translation:
        (body.data.translation as TranslationResult | undefined) ?? null,
      job: body.data.job as TranslationJobStatus,
      accepted: false,
    };
  }

  return {
    translation: body.data as TranslationResult,
    job: null,
    accepted: false,
  };
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }
  return undefined;
}

function extractLookupFlags(payload: unknown): {
  warming: boolean;
  stale: boolean;
} {
  if (!payload || typeof payload !== "object") {
    return { warming: false, stale: false };
  }

  const body = payload as { data?: unknown };
  const candidate =
    body.data && typeof body.data === "object"
      ? (body.data as Record<string, unknown>)
      : (payload as Record<string, unknown>);

  return {
    warming: candidate.warming === true,
    stale: candidate.stale === true,
  };
}

function parseJobStatusPayload(
  payload: unknown,
  status: number,
): TranslationJobStatus {
  const parsed = cachedTranslationResponseSchema.safeParse(payload);
  if (parsed.success) {
    throw new TranslationApiError("Expected a job status response", {
      code: "UNKNOWN",
      status,
    });
  }

  const jobPayload = payload as {
    ok?: boolean;
    data?: { job?: TranslationJobStatus };
  };

  if (jobPayload?.ok && jobPayload.data?.job) {
    return jobPayload.data.job;
  }

  throw new TranslationApiError("Invalid translation job response", {
    code: "UNKNOWN",
    status,
  });
}

// ============================================================================
// API Functions
// ============================================================================

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

export async function requestTranslationGeneration(
  request: TranslationRequest,
): Promise<TranslationGenerateResult> {
  const baseUrl = getApiBaseUrl();
  const headers = {
    ...(await getAuthHeadersAsync()),
    Prefer: "respond-async",
  };
  const body = JSON.stringify({
    sourceLang: request.sourceLang,
    forceRefresh: request.forceRefresh,
    respondAsync: true,
  });

  const response = await fetch(
    `${baseUrl}/api/v1/internal/posts/${request.year}/${request.slug}/translations/${request.targetLang}/generate?async=true`,
    {
      method: "POST",
      headers,
      body,
    },
  );

  if (!response.ok) {
    throw await parseError(response);
  }

  const payload = await response.json().catch(() => null);
  return parseGenerateResult(payload, response.status);
}

export async function getTranslationGenerationStatus(
  request: Pick<TranslationRequest, "year" | "slug" | "targetLang">,
  jobId?: string,
): Promise<TranslationJobStatus> {
  const baseUrl = getApiBaseUrl();
  const headers = await getAuthHeadersAsync();
  const params = jobId ? `?jobId=${encodeURIComponent(jobId)}` : "";

  const response = await fetch(
    `${baseUrl}/api/v1/internal/posts/${request.year}/${request.slug}/translations/${request.targetLang}/generate/status${params}`,
    {
      method: "GET",
      headers,
    },
  );

  if (!response.ok) {
    throw await parseError(response);
  }

  const payload = await response.json().catch(() => null);
  return parseJobStatusPayload(payload, response.status);
}

/**
 * Get the public translation for a post.
 * The public route may serve cache hits or generate a fresh translation.
 */
export async function getCachedTranslation(
  year: string,
  slug: string,
  targetLang: string,
): Promise<PublicTranslationLookupResult> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/v1/public/posts/${year}/${slug}/translations/${targetLang}`,
  );
  const retryAfterSeconds = parseRetryAfterSeconds(
    response.headers.get("Retry-After"),
  );

  if (!response.ok) {
    if (response.status === 404) {
      return {
        translation: null,
        pending: false,
        job: null,
        retryAfterSeconds,
        warming: false,
        stale: false,
      };
    }
    throw await parseError(response);
  }

  const payload = await response.json().catch(() => null);
  if (
    response.status === 202 &&
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    (payload as { data?: unknown }).data === null
  ) {
    return {
      translation: null,
      pending: true,
      job: null,
      retryAfterSeconds,
      warming: true,
      stale: false,
    };
  }

  const result = parseGenerateResult(payload, response.status);
  const flags = extractLookupFlags(payload);

  return {
    translation: result.translation,
    pending: response.status === 202 || result.accepted || flags.warming,
    job: result.job,
    retryAfterSeconds,
    warming: flags.warming,
    stale: flags.stale,
  };
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
    const response = await fetch(
      `${baseUrl}/api/v1/internal/posts/${year}/${slug}/translations/${targetLang}`,
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
