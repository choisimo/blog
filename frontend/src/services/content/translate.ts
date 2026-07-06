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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseTranslationJobStatus(value: unknown): TranslationJobStatus | null {
  if (!isRecord(value)) return null;
  const id = normalizeJobId(value.id);
  const statusUrl = normalizeJobText(value.statusUrl);
  const cacheUrl = normalizeJobText(value.cacheUrl);
  const generateUrl = normalizeJobText(value.generateUrl);

  if (
    !id ||
    (value.status !== "running" &&
      value.status !== "succeeded" &&
      value.status !== "failed") ||
    !statusUrl ||
    !cacheUrl ||
    !generateUrl
  ) {
    return null;
  }

  const job: TranslationJobStatus = {
    id,
    status: value.status,
    statusUrl,
    cacheUrl,
    generateUrl,
  };

  const errorMessage = isRecord(value.error)
    ? normalizeJobText(value.error.message)
    : null;
  if (isRecord(value.error) && errorMessage) {
    job.error = {
      message: errorMessage,
      ...(normalizeJobText(value.error.code)
        ? { code: normalizeJobText(value.error.code) as string }
        : {}),
      ...(typeof value.error.retryable === "boolean"
        ? { retryable: value.error.retryable }
        : {}),
      ...(typeof value.error.retryAfterSeconds === "number" &&
      Number.isFinite(value.error.retryAfterSeconds)
        ? { retryAfterSeconds: value.error.retryAfterSeconds }
        : {}),
    };
  }

  return job;
}

function invalidTranslationJobError(status: number): TranslationApiError {
  return new TranslationApiError("Invalid translation job response", {
    code: "UNKNOWN",
    status,
  });
}

const TRANSLATION_YEAR_PATTERN = /^\d{4}$/;
const TRANSLATION_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const TRANSLATION_LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/;
const TRANSLATION_JOB_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const TRANSLATION_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;

function decodeTranslationSelector(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return decodeURIComponent(trimmed).trim();
  } catch {
    return trimmed;
  }
}

function normalizeTranslationSegment(
  value: string,
  label: string,
  pattern: RegExp,
): string {
  const normalized = decodeTranslationSelector(value);
  if (!normalized || !pattern.test(normalized)) {
    throw new TranslationApiError(`Invalid translation ${label}`, {
      code: "UNKNOWN",
      status: 400,
    });
  }

  return encodeURIComponent(normalized);
}

function normalizeOptionalJobId(value?: string): string | null {
  if (value === undefined) return null;

  const normalized = decodeTranslationSelector(value);
  if (!normalized) return null;
  if (!TRANSLATION_JOB_ID_PATTERN.test(normalized)) {
    throw new TranslationApiError("Invalid translation job id", {
      code: "UNKNOWN",
      status: 400,
    });
  }

  return normalized;
}

function normalizeJobText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  const decoded = decodeTranslationSelector(normalized);
  if (
    !normalized ||
    !decoded ||
    [normalized, decoded].some((candidate) => TRANSLATION_CONTROL_PATTERN.test(candidate))
  ) {
    return null;
  }
  return normalized;
}

function normalizeJobId(value: unknown): string | null {
  const normalized = normalizeJobText(value);
  if (!normalized) return null;
  return TRANSLATION_JOB_ID_PATTERN.test(normalized) ? normalized : null;
}

function getTranslationPathSegments(
  request: Pick<TranslationRequest, "year" | "slug" | "targetLang">,
): { year: string; slug: string; targetLang: string } {
  return {
    year: normalizeTranslationSegment(request.year, "year", TRANSLATION_YEAR_PATTERN),
    slug: normalizeTranslationSegment(request.slug, "slug", TRANSLATION_SLUG_PATTERN),
    targetLang: normalizeTranslationSegment(
      request.targetLang,
      "target language",
      TRANSLATION_LANGUAGE_PATTERN,
    ),
  };
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
    const job = parseTranslationJobStatus(body.job);
    if (!job) {
      throw invalidTranslationJobError(status);
    }

    return {
      translation: null,
      job,
      accepted: true,
    };
  }

  if (isRecord(body.data) && "job" in body.data) {
    const job = parseTranslationJobStatus(body.data.job);
    if (!job) {
      throw invalidTranslationJobError(status);
    }

    return {
      translation:
        (body.data.translation as TranslationResult | undefined) ?? null,
      job,
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
    data?: { job?: unknown };
  };

  if (jobPayload?.ok && jobPayload.data?.job) {
    const job = parseTranslationJobStatus(jobPayload.data.job);
    if (job) {
      return job;
    }
  }

  throw invalidTranslationJobError(status);
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
  const path = getTranslationPathSegments(request);
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
    `${baseUrl}/api/v1/internal/posts/${path.year}/${path.slug}/translations/${path.targetLang}/generate`,
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
  const path = getTranslationPathSegments(request);
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
    `${baseUrl}/api/v1/internal/posts/${path.year}/${path.slug}/translations/${path.targetLang}/generate?async=true`,
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
  const path = getTranslationPathSegments(request);
  const normalizedJobId = normalizeOptionalJobId(jobId);
  const baseUrl = getApiBaseUrl();
  const headers = await getAuthHeadersAsync();
  const params = normalizedJobId ? `?jobId=${encodeURIComponent(normalizedJobId)}` : "";

  const response = await fetch(
    `${baseUrl}/api/v1/internal/posts/${path.year}/${path.slug}/translations/${path.targetLang}/generate/status${params}`,
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
  const path = getTranslationPathSegments({ year, slug, targetLang });
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/v1/public/posts/${path.year}/${path.slug}/translations/${path.targetLang}`,
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
    const path = getTranslationPathSegments({ year, slug, targetLang });
    const baseUrl = getApiBaseUrl();
    const headers = await getAuthHeadersAsync();
    const response = await fetch(
      `${baseUrl}/api/v1/internal/posts/${path.year}/${path.slug}/translations/${path.targetLang}`,
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
