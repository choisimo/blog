import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

import { ConfigManager } from "@/components/features/admin/ConfigManager";

describe("ConfigManager protected-environment mode", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mocks.toast.mockReset();
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

  it("filters unsafe config variable keys before rendering and saving", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
                      key: "SAFE_KEY",
                      type: "text",
                      description: "Safe key",
                    },
                    {
                      key: "BAD_KEY\r\nX-Injected: yes",
                      type: "text",
                      description: "Polluted key",
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
                SAFE_KEY: {
                  value: "safe-value",
                  isSecret: false,
                  isSet: true,
                  default: "",
                },
                "BAD_KEY\r\nX-Injected: yes": {
                  value: "polluted-value",
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

      if (url.endsWith("/api/v1/admin/config/save-env")) {
        expect(JSON.parse(String(init?.body))).toEqual({
          variables: {
            SAFE_KEY: "updated-safe-value",
          },
          target: "backend",
        });

        return new Response(JSON.stringify({ ok: true, data: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
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

    const input = await screen.findByLabelText("SAFE_KEY");
    expect(screen.queryByText(/Polluted key/i)).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "updated-safe-value" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.nodove.com/api/v1/admin/config/save-env",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("surfaces backend export failure details in the admin toast", async () => {
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
                  variables: [],
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
              config: {},
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.endsWith("/api/v1/admin/config/export")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: { message: "Export\u0000 blocked\r\nby protected environment" },
          }),
          {
            status: 503,
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

    fireEvent.click(await screen.findByRole("button", { name: ".env" }));

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        title: "Export failed",
        description: "Export blocked by protected environment",
        variant: "destructive",
      });
    });
  });
});
