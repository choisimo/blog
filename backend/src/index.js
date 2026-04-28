import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import {
  config,
  publicRuntimeConfig,
  loadAndApplyConsulConfig,
  assertSecurityConfiguration,
} from "./config.js";
import { requireBackendKey } from "./middleware/backendAuth.js";
import { requireGatewaySignature } from "./middleware/gatewaySignature.js";
import { httpCache } from "./middleware/httpCache.js";
import { httpRequestDuration, httpRequestsTotal } from "./lib/metrics.js";
import { logger, enablePgLogs } from "./lib/logger.js";
import {
  runMigrations,
  isPgConfigured,
  testPgConnection,
} from "./repositories/analytics.repository.js";
import { closeRedis, isRedisAvailable } from "./lib/redis-client.js";
import { testConnection as testD1Connection } from "./lib/d1.js";
import {
  buildHealthPayload,
  buildReadinessResponse,
  markReadinessDegraded,
  runReadinessChecks,
} from "./lib/readiness.js";
import { aiService } from "./services/ai/ai.service.js";
import { getDomainOutboxRepository } from "./repositories/domain-outbox.repository.js";
import metricsRouter from "./routes/metrics.js";
import { initChatWebSocket } from "./routes/chat.js";
import { getLiveRedisBridgeSnapshot } from "./services/live-chat.service.js";
import { startBackendDomainOutboxWorker } from "./services/backend-outbox.service.js";
import {
  PUBLIC_ROUTE_REGISTRY,
  getProtectedRouteRegistry,
  mountRouteRegistry,
} from "./routes/registry.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const READINESS_CHECK_TIMEOUT_MS = Number.parseInt(
  process.env.READINESS_CHECK_TIMEOUT_MS || "1500",
  10,
);

function getReadinessCheckTimeoutMs() {
  return Number.isFinite(READINESS_CHECK_TIMEOUT_MS)
    ? Math.max(250, READINESS_CHECK_TIMEOUT_MS)
    : 1500;
}

async function withReadinessTimeout(name, check) {
  const timeoutMs = getReadinessCheckTimeoutMs();

  let timeout;
  try {
    return await Promise.race([
      Promise.resolve().then(check),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${name} readiness check timed out`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function dependencyNotConfigured(required) {
  return {
    ok: !required,
    status: required ? "not_configured" : "skipped",
  };
}

function buildBackendReadinessChecks() {
  const protectedRuntime = config.security?.protectedEnvironment === true;

  return [
    {
      name: "postgres",
      required: protectedRuntime || isPgConfigured(),
      check: async () => {
        if (!isPgConfigured()) {
          return dependencyNotConfigured(protectedRuntime);
        }
        const ok = await withReadinessTimeout("postgres", testPgConnection);
        return { ok, status: ok ? "ok" : "failed" };
      },
    },
    {
      name: "redis",
      required: protectedRuntime || Boolean(config.redis?.url),
      check: async () => {
        if (!config.redis?.url) {
          return dependencyNotConfigured(protectedRuntime);
        }
        const ok = await withReadinessTimeout("redis", isRedisAvailable);
        return { ok, status: ok ? "ok" : "failed" };
      },
    },
    {
      name: "d1",
      required: protectedRuntime,
      check: async () => {
        const ok = await withReadinessTimeout("d1", testD1Connection);
        return { ok, status: ok ? "ok" : "failed" };
      },
    },
    {
      name: "chroma",
      required: config.features?.ragEnabled === true,
      check: async () => {
        if (!config.features?.ragEnabled) {
          return dependencyNotConfigured(false);
        }
        if (!config.rag?.chromaUrl) {
          return dependencyNotConfigured(true);
        }

        const heartbeatUrl = new URL("/api/v2/heartbeat", config.rag.chromaUrl);
        const response = await withReadinessTimeout("chroma", () =>
          fetch(heartbeatUrl, {
            signal: AbortSignal.timeout(getReadinessCheckTimeoutMs()),
          }),
        );
        return {
          ok: response.ok,
          status: response.ok ? "ok" : "failed",
          detail: response.ok ? null : `HTTP ${response.status}`,
        };
      },
    },
    {
      name: "ai",
      required: config.features?.aiEnabled === true,
      check: async () => {
        if (!config.features?.aiEnabled) {
          return dependencyNotConfigured(false);
        }

        const health = await withReadinessTimeout("ai", () => aiService.health(false));
        return {
          ok: health?.ok === true,
          status: health?.ok === true ? "ok" : "failed",
          detail: health?.error || null,
        };
      },
    },
    {
      name: "worker",
      required: protectedRuntime,
      check: async () => {
        if (!config.services?.workerApiUrl) {
          return dependencyNotConfigured(protectedRuntime);
        }

        const configUrl = new URL("/api/v1/public/config", config.services.workerApiUrl);
        const response = await withReadinessTimeout("worker", () =>
          fetch(configUrl, {
            signal: AbortSignal.timeout(getReadinessCheckTimeoutMs()),
          }),
        );
        return {
          ok: response.ok,
          status: response.ok ? "ok" : "failed",
          detail: response.ok ? null : `HTTP ${response.status}`,
        };
      },
    },
    {
      name: "domain_outbox",
      required: protectedRuntime,
      check: async () => {
        const repository = getDomainOutboxRepository();
        const [storageMode, stats] = await withReadinessTimeout(
          "domain_outbox",
          () => Promise.all([repository.getStorageMode(), repository.getStats({})]),
        );
        const durable = storageMode !== "memory";
        const ok = durable && Number(stats.deadLetter || 0) === 0 && Number(stats.stuck || 0) === 0;

        return {
          ok,
          status: ok ? "ok" : "failed",
          detail: {
            storageMode,
            deadLetter: Number(stats.deadLetter || 0),
            stuck: Number(stats.stuck || 0),
          },
        };
      },
    },
  ];
}

async function startServer() {
  await loadAndApplyConsulConfig();
  assertSecurityConfiguration();

  if (isPgConfigured()) {
    try {
      await runMigrations();
      enablePgLogs();
      logger.info({}, "PostgreSQL migrations applied");
    } catch (err) {
      if (config.security?.protectedEnvironment === true) {
        logger.error({}, "PostgreSQL migration failed in protected environment", {
          error: err.message,
        });
        throw err;
      }

      markReadinessDegraded("postgres_migration_failed");
      logger.warn({}, "PostgreSQL migration failed, continuing in degraded mode", {
        error: err.message,
      });
    }
  }

  const app = express();

  app.set("trust proxy", config.trustProxy);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  const corsOptions = {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const ok = config.allowedOrigins.some((o) => o === origin);
      return callback(ok ? null : new Error("Not allowed by CORS"), ok);
    },
    credentials: true,
  };
  app.use(cors(corsOptions));

  app.use(morgan("combined"));
  app.use(
    requireGatewaySignature({
      allowBackendKey: config.security?.protectedEnvironment !== true,
      bypassPaths: ["/api/v1/healthz", "/health", "/api/v1/readiness"],
    }),
  );

  app.use((req, res, next) => {
    const end = httpRequestDuration.startTimer();
    res.on("finish", () => {
      const route = req.route?.path || req.path || "unknown";
      const labels = { method: req.method, route, status_code: res.statusCode };
      end(labels);
      httpRequestsTotal.inc(labels);
    });
    next();
  });

  app.get("/api/v1/healthz", (req, res) => {
    res.json(
      buildHealthPayload({ env: config.appEnv, uptime: process.uptime() }),
    );
  });

  app.get("/health", (req, res) => {
    res.json(
      buildHealthPayload({ env: config.appEnv, uptime: process.uptime() }),
    );
  });

  app.get("/api/v1/readiness", async (req, res) => {
    const dependencyChecks = await runReadinessChecks(buildBackendReadinessChecks());
    const readiness = buildReadinessResponse(
      {
        env: config.appEnv,
        uptime: process.uptime(),
        liveRedisBridge: getLiveRedisBridgeSnapshot(),
        processLocalState: {
          mode: process.env.BACKEND_STATE_MODE || "single-instance",
          durable: false,
          constraint: "See docs/operational-state.md before horizontal scaling",
        },
      },
      dependencyChecks,
    );
    res.status(readiness.statusCode).json(readiness.body);
  });

  app.get(
    "/api/v1/public/config",
    httpCache({ ttl: 300, prefix: "config" }),
    (req, res) => {
      res.json({ ok: true, data: publicRuntimeConfig() });
    },
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.use(PUBLIC_ROUTE_REGISTRY.map((entry) => entry.basePath), requireBackendKey);
  mountRouteRegistry(app, PUBLIC_ROUTE_REGISTRY);

  app.use("/metrics", requireBackendKey, metricsRouter);

  app.use(requireBackendKey);

  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  mountRouteRegistry(app, getProtectedRouteRegistry());

  app.use(notFoundHandler);
  app.use(errorHandler);

  const port = config.port;
  const host = config.host;
  const server = app.listen(port, host, () => {
    logger.info({ port, host }, `listening on http://${host}:${port}`);
    logger.info(
      {
        features: {
          ai: config.features.aiEnabled,
          rag: config.features.ragEnabled,
          comments: config.features.commentsEnabled,
          terminal: config.features.terminalEnabled,
          codeExecution: config.features.codeExecutionEnabled,
        },
      },
      "features",
    );
  });

  if (config.services.chatWebSocketEnabled) {
    initChatWebSocket(server);
  } else {
    logger.info({}, 'Chat WebSocket transport disabled - SSE-only mode');
  }

  const backendOutboxWorker = startBackendDomainOutboxWorker();

  let shuttingDown = false;
  function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Received shutdown signal, closing server...");
    backendOutboxWorker.stop();

    server.close(async () => {
      logger.info({}, "HTTP server closed");
      try {
        await closeRedis();
        logger.info({}, "Redis connections closed");
      } catch (err) {
        logger.error({ err }, "Failed to close Redis connections");
      }
      process.exit(0);
    });

    setTimeout(() => {
      logger.error({}, "Shutdown timed out after 10s, forcing exit");
      process.exit(1);
    }, 10_000);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "Unhandled promise rejection");
  });

  process.on("uncaughtException", (err) => {
    logger.error({ err }, "Uncaught exception — shutting down");
    gracefulShutdown("uncaughtException");
  });
}

startServer().catch((err) => {
  logger.error({}, "Failed to start server", {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});
