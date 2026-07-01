import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigManager } from "@/components/features/admin/ConfigManager";

describe("ConfigManager protected-environment mode", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    (
      window as Window & {
        APP_CONFIG?: { apiBaseUrl?: string | null };
        __APP_CONFIG?: { apiBaseUrl?: string | null };
      }
    ).APP_CONFIG = {
      apiBaseUrl: "https://api.nodove.com",
    };
    delete (window as Window & { __APP_CONFIG?: unknown }).__APP_CONFIG;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("hides save controls and shows GitOps guidance when config mutations are disabled", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith("/api/v1/admin/config/categories")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              categories: [
                {
                  id: "app",
                  name: "Application",
                  description: "server settings",
                  variables: [
                    {
                      key: "SITE_BASE_URL",
                      type: "url",
                      description: "Site URL",
                    },
                  ],
                },
              ],
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.endsWith("/api/v1/admin/config/current")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              mutationsEnabled: false,
              mutationGuidance:
                "Runtime environment edits are disabled in protected environments. Update the Git-managed source of truth, Secret, or ConfigMap and redeploy.",
              config: {
                SITE_BASE_URL: {
                  value: "https://noblog.nodove.com",
                  isSecret: false,
                  isSet: true,
                  default: "",
                },
              },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ConfigManager />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Read-only runtime config/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/GitOps only/i)).toBeInTheDocument();
    expect(screen.getByText(/ConfigMap and redeploy/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Wrangler/i })).toBeInTheDocument();
    expect(screen.queryByText("Save")).not.toBeInTheDocument();

    const input = screen.getByDisplayValue("https://noblog.nodove.com");
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveAttribute("disabled");
  });

  it("shows a load error instead of an empty config panel when categories fail", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith("/api/v1/admin/config/categories")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: { message: "Config service unavailable" },
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.endsWith("/api/v1/admin/config/current")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              mutationsEnabled: true,
              config: {},
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ConfigManager />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Unable to load configuration/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Config service unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/Environment config/i)).not.toBeInTheDocument();
  });

  it("labels icon controls with their config keys", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith("/api/v1/admin/config/categories")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              categories: [
                {
                  id: "app",
                  name: "Application",
                  description: "server settings",
                  variables: [
                    {
                      key: "SECRET_TOKEN",
                      type: "password",
                      description: "Secret token",
                    },
                    {
                      key: "SITE_BASE_URL",
                      type: "url",
                      description: "Site URL",
                    },
                  ],
                },
              ],
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.endsWith("/api/v1/admin/config/current")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              mutationsEnabled: true,
              config: {
                SECRET_TOKEN: {
                  value: "secret-value",
                  isSecret: true,
                  isSet: true,
                  default: "",
                },
                SITE_BASE_URL: {
                  value: "https://noblog.nodove.com",
                  isSecret: false,
                  isSet: true,
                  default: "",
                },
              },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ConfigManager />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("button", { name: "Show SECRET_TOKEN value" }))
      .toHaveAttribute("title", "Show SECRET_TOKEN value");
    expect(screen.getByRole("button", { name: "Copy SITE_BASE_URL URL" }))
      .toHaveAttribute("title", "Copy SITE_BASE_URL URL");
  });
});
