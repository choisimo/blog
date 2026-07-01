import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkersManager } from "@/components/features/admin/WorkersManager";

function createWorkerListResponse(mutationsEnabled: boolean) {
  return {
    ok: true,
    data: {
      workers: [
        {
          id: "api-gateway",
          name: "API Gateway",
          description: "Primary edge facade",
          path: "api-gateway",
          wranglerPath: "api-gateway/wrangler.toml",
          hasProduction: true,
          mutationsEnabled,
          exists: true,
          config: {
            name: "api-gateway",
            main: "src/index.ts",
            compatibility_date: "2025-01-01",
            account_id: "1234567890abcdef",
            vars: { ENV: "dev-value-should-stay-hidden" },
            production: {
              name: "api-gateway-prod",
              vars: { ENV: "prod-value-should-stay-hidden" },
            },
            d1_databases: [],
            r2_buckets: [],
            kv_namespaces: [],
          },
        },
      ],
    },
  };
}

describe("WorkersManager read-only production mode", () => {
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

  it("replaces deploy controls with GitOps guidance when worker mutations are disabled", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith("/api/v1/admin/workers/list")) {
        return new Response(JSON.stringify(createWorkerListResponse(false)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/v1/admin/workers/secrets")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              secrets: [
                {
                  key: "JWT_SECRET",
                  description: "JWT signing key",
                  workers: ["api-gateway"],
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

      if (
        url.endsWith("/api/v1/admin/workers/d1/databases") ||
        url.endsWith("/api/v1/admin/workers/kv/namespaces") ||
        url.endsWith("/api/v1/admin/workers/r2/buckets")
      ) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { databases: [], namespaces: [], buckets: [] },
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
        <WorkersManager subtab="workers" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/GitHub Actions와 GitOps 경로/),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /API Gateway/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Production deploys are read-only here/),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/Manifest Present/)).toBeInTheDocument();
    expect(screen.getByText(/Live deploy/)).toBeInTheDocument();
    expect(screen.getByText(/not verified here/)).toBeInTheDocument();
    expect(screen.queryByText("Deploy")).not.toBeInTheDocument();
    expect(screen.queryByText("Dry Run")).not.toBeInTheDocument();
    expect(
      screen.getByText(".github/workflows/deploy-blog-workflow.yml"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Account" }))
      .toHaveAttribute("title", "Copy Account");
  });

  it("shows manifest variable keys without exposing their values", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith("/api/v1/admin/workers/list")) {
        return new Response(JSON.stringify(createWorkerListResponse(false)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/v1/admin/workers/secrets")) {
        return new Response(
          JSON.stringify({ ok: true, data: { secrets: [] } }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (
        url.endsWith("/api/v1/admin/workers/d1/databases") ||
        url.endsWith("/api/v1/admin/workers/kv/namespaces") ||
        url.endsWith("/api/v1/admin/workers/r2/buckets")
      ) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { databases: [], namespaces: [], buckets: [] },
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
        <WorkersManager subtab="workers" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /API Gateway/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /API Gateway/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Manifest Variables/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Values are hidden in the admin UI/),
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText("ENV")).toHaveLength(2);
    expect(
      screen.queryByText("dev-value-should-stay-hidden"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("prod-value-should-stay-hidden"),
    ).not.toBeInTheDocument();
  });

  it("shows a load error instead of an empty workers list when worker inventory fails", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith("/api/v1/admin/workers/list")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: { message: "Workers inventory unavailable" },
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.endsWith("/api/v1/admin/workers/secrets")) {
        return new Response(
          JSON.stringify({ ok: true, data: { secrets: [] } }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (
        url.endsWith("/api/v1/admin/workers/d1/databases") ||
        url.endsWith("/api/v1/admin/workers/kv/namespaces") ||
        url.endsWith("/api/v1/admin/workers/r2/buckets")
      ) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { databases: [], namespaces: [], buckets: [] },
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
        <WorkersManager subtab="workers" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Unable to load workers/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Workers inventory unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/No workers found/i)).not.toBeInTheDocument();
  });

  it("shows a load error instead of an empty secrets list when worker secrets fail", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith("/api/v1/admin/workers/list")) {
        return new Response(JSON.stringify(createWorkerListResponse(false)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/v1/admin/workers/secrets")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: { message: "Worker secrets unavailable" },
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (
        url.endsWith("/api/v1/admin/workers/d1/databases") ||
        url.endsWith("/api/v1/admin/workers/kv/namespaces") ||
        url.endsWith("/api/v1/admin/workers/r2/buckets")
      ) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { databases: [], namespaces: [], buckets: [] },
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
        <WorkersManager subtab="secrets" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Unable to load worker secrets/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Worker secrets unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/No secrets defined/i)).not.toBeInTheDocument();
  });

  it("labels worker secret visibility controls with their keys", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith("/api/v1/admin/workers/list")) {
        return new Response(JSON.stringify(createWorkerListResponse(true)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/v1/admin/workers/secrets")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              secrets: [
                {
                  key: "JWT_SECRET",
                  description: "JWT signing key",
                  workers: ["api-gateway"],
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

      if (
        url.endsWith("/api/v1/admin/workers/d1/databases") ||
        url.endsWith("/api/v1/admin/workers/kv/namespaces") ||
        url.endsWith("/api/v1/admin/workers/r2/buckets")
      ) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { databases: [], namespaces: [], buckets: [] },
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
        <WorkersManager subtab="secrets" />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("button", { name: "Show JWT_SECRET secret" }))
      .toHaveAttribute("title", "Show JWT_SECRET secret");
  });

  it("shows a load error instead of an empty resource section when worker resources fail", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith("/api/v1/admin/workers/list")) {
        return new Response(JSON.stringify(createWorkerListResponse(false)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/v1/admin/workers/secrets")) {
        return new Response(
          JSON.stringify({ ok: true, data: { secrets: [] } }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.endsWith("/api/v1/admin/workers/d1/databases")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: { message: "D1 inventory unavailable" },
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (
        url.endsWith("/api/v1/admin/workers/kv/namespaces") ||
        url.endsWith("/api/v1/admin/workers/r2/buckets")
      ) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { namespaces: [], buckets: [] },
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
        <WorkersManager subtab="resources" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Unable to load D1 databases/i),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/D1 inventory unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Retry D1 Databases/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No databases found/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No KV namespaces found/i)).toBeInTheDocument();
    expect(screen.getByText(/No R2 buckets found/i)).toBeInTheDocument();
  });
});
