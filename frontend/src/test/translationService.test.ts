import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getTranslationGenerationStatus,
  requestTranslationGeneration,
  TranslationApiError,
} from "@/services/content/translate";

const mocks = vi.hoisted(() => ({
  getAuthHeadersAsync: vi.fn(),
}));

vi.mock("@/utils/network/apiBase", () => ({
  getApiBaseUrl: () => "https://api.example.com",
}));

vi.mock("@/stores/session/useAuthStore", () => ({
  getAuthHeadersAsync: mocks.getAuthHeadersAsync,
}));

const request = {
  year: "2026",
  slug: "translation-hardening",
  targetLang: "en",
};

const validJob = {
  id: "job-1",
  status: "running",
  statusUrl: "/status/job-1",
  cacheUrl: "/cache/job-1",
  generateUrl: "/generate/job-1",
};

describe("translation service", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthHeadersAsync.mockResolvedValue({
      Authorization: "Bearer admin-token",
      "Content-Type": "application/json",
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns validated async translation jobs", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({
        ok: true,
        data: null,
        job: {
          ...validJob,
          ignored: "value",
        },
      }),
    });

    await expect(requestTranslationGeneration(request)).resolves.toEqual({
      translation: null,
      job: validJob,
      accepted: true,
    });
  });

  it("rejects blank translation path segments before auth lookup or network", async () => {
    await expect(
      requestTranslationGeneration({
        ...request,
        slug: " \n\t ",
      }),
    ).rejects.toMatchObject({
      name: "TranslationApiError",
      message: "Invalid translation slug",
      status: 400,
    } satisfies Partial<TranslationApiError>);

    expect(mocks.getAuthHeadersAsync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsafe translation path selectors before auth lookup or network", async () => {
    await expect(
      requestTranslationGeneration({
        ...request,
        year: "2026%0a",
      }),
    ).rejects.toMatchObject({
      name: "TranslationApiError",
      message: "Invalid translation year",
      status: 400,
    } satisfies Partial<TranslationApiError>);

    await expect(
      requestTranslationGeneration({
        ...request,
        slug: "../translation-hardening",
      }),
    ).rejects.toMatchObject({
      name: "TranslationApiError",
      message: "Invalid translation slug",
      status: 400,
    } satisfies Partial<TranslationApiError>);

    await expect(
      requestTranslationGeneration({
        ...request,
        targetLang: "en%0aUS",
      }),
    ).rejects.toMatchObject({
      name: "TranslationApiError",
      message: "Invalid translation target language",
      status: 400,
    } satisfies Partial<TranslationApiError>);

    expect(mocks.getAuthHeadersAsync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trims safe translation path and query parameters", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          job: validJob,
        },
      }),
    });

    await getTranslationGenerationStatus(
      {
        year: " 2026 ",
        slug: " translation-hardening ",
        targetLang: " en-US ",
      },
      " job-1 ",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/internal/posts/2026/translation-hardening/translations/en-US/generate/status?jobId=job-1",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("rejects unsafe translation job IDs before auth lookup or network", async () => {
    await expect(
      getTranslationGenerationStatus(request, "job%091"),
    ).rejects.toMatchObject({
      name: "TranslationApiError",
      message: "Invalid translation job id",
      status: 400,
    } satisfies Partial<TranslationApiError>);

    expect(mocks.getAuthHeadersAsync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed async translation jobs", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({
        ok: true,
        data: null,
        job: {
          ...validJob,
          status: "queued",
        },
      }),
    });

    await expect(requestTranslationGeneration(request)).rejects.toMatchObject({
      name: "TranslationApiError",
      message: "Invalid translation job response",
      status: 202,
    } satisfies Partial<TranslationApiError>);
  });

  it("rejects async translation jobs with unsafe metadata", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({
        ok: true,
        data: null,
        job: {
          ...validJob,
          id: "job%7f1",
        },
      }),
    });

    await expect(requestTranslationGeneration(request)).rejects.toMatchObject({
      name: "TranslationApiError",
      message: "Invalid translation job response",
      status: 202,
    } satisfies Partial<TranslationApiError>);
  });

  it("returns validated translation generation status jobs", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          job: {
            ...validJob,
            status: "failed",
            error: {
              message: "AI timeout",
              code: "AI_TIMEOUT",
              retryable: true,
              retryAfterSeconds: 30,
              ignored: "value",
            },
          },
        },
      }),
    });

    await expect(getTranslationGenerationStatus(request, "job-1")).resolves.toEqual({
      ...validJob,
      status: "failed",
      error: {
        message: "AI timeout",
        code: "AI_TIMEOUT",
        retryable: true,
        retryAfterSeconds: 30,
      },
    });
  });

  it("rejects malformed translation generation status jobs", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          job: {
            ...validJob,
            statusUrl: null,
          },
        },
      }),
    });

    await expect(
      getTranslationGenerationStatus(request, "job-1"),
    ).rejects.toMatchObject({
      name: "TranslationApiError",
      message: "Invalid translation job response",
      status: 200,
    } satisfies Partial<TranslationApiError>);
  });
});
