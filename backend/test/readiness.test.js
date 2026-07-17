import test from "node:test";
import assert from "node:assert/strict";

import {
  buildHealthPayload,
  buildReadinessResponse,
  markReadinessDegraded,
  resetReadinessState,
  runReadinessChecks,
} from "../src/lib/readiness.js";

test("readiness reports degraded state after a dependency failure", () => {
  resetReadinessState();
  markReadinessDegraded("postgres_migration_failed");

  const health = buildHealthPayload({ env: "test" });
  const readiness = buildReadinessResponse({ env: "test" });

  assert.equal(health.status, "degraded");
  assert.equal(health.degraded, true);
  assert.deepEqual(health.degradedReasons, ["postgres_migration_failed"]);
  assert.equal(readiness.statusCode, 503);
  assert.equal(readiness.body.ok, false);
  assert.deepEqual(readiness.body.degradedReasons, ["postgres_migration_failed"]);

  resetReadinessState();
});

test("readiness reports required dependency failures", () => {
  resetReadinessState();

  const readiness = buildReadinessResponse(
    { env: "test" },
    [{ name: "redis", ok: false, required: true, status: "failed" }],
  );

  assert.equal(readiness.statusCode, 503);
  assert.equal(readiness.body.ok, false);
  assert.deepEqual(readiness.body.dependencies, [
    {
      name: "redis",
      ok: false,
      required: true,
      status: "failed",
      detail: null,
      checkedAt: readiness.body.dependencies[0].checkedAt,
    },
  ]);
  assert.ok(
    readiness.body.degradedReasons.includes("dependency_redis_unavailable"),
  );
});

test("readiness keeps serving traffic when an optional dependency fails", () => {
  resetReadinessState();

  const readiness = buildReadinessResponse(
    { env: "test" },
    [{ name: "ai", ok: false, required: false, status: "failed", detail: "HTTP 502" }],
  );

  assert.equal(readiness.statusCode, 200);
  assert.equal(readiness.body.ok, true);
  assert.deepEqual(readiness.body.degradedReasons, []);
  assert.deepEqual(readiness.body.dependencies, [
    {
      name: "ai",
      ok: false,
      required: false,
      status: "failed",
      detail: "HTTP 502",
      checkedAt: readiness.body.dependencies[0].checkedAt,
    },
  ]);
});

test("readiness checks fail closed when a dependency probe throws", async () => {
  const [dependency] = await runReadinessChecks([
    {
      name: "postgres",
      required: true,
      check: async () => {
        throw new Error("connection refused");
      },
    },
  ]);

  assert.equal(dependency.name, "postgres");
  assert.equal(dependency.ok, false);
  assert.equal(dependency.required, true);
  assert.equal(dependency.status, "failed");
  assert.equal(dependency.detail, "connection refused");
});

test("security config rejects protected placeholder secrets and image proxy gaps", async () => {
  process.env.AI_DEFAULT_MODEL ||= "gpt-test";
  const { getSecurityConfigurationErrors: getConfigSecurityErrors } = await import("../src/config/index.js");
  const errors = getConfigSecurityErrors({
    security: {
      protectedEnvironment: true,
      allowInsecureDevAuth: false,
      gatewaySigningSecret: "replace-me",
    },
    backendKey: "replace-me",
    auth: { jwtSecret: "jwt-secret" },
    admin: {},
    oauth: {},
    ai: {
      apiKey: "sk-placeholder",
      image: {
        proxyBaseUrl: "https://ai.example/v1",
        proxyApiKey: "",
      },
    },
    services: {},
    assetsBaseUrl: "",
    features: {
      aiEnabled: true,
      adminAiImageEnabled: true,
    },
  });

  assert.ok(errors.some((error) => error.includes("BACKEND_KEY")));
  assert.ok(errors.some((error) => error.includes("GATEWAY_SIGNING_SECRET")));
  assert.ok(errors.some((error) => error.includes("AI_API_KEY")));
  assert.ok(errors.some((error) => error.includes("AI_IMAGE_PROXY_API_KEY")));
  assert.ok(errors.some((error) => error.includes("WORKER_API_URL")));
  assert.ok(errors.some((error) => error.includes("ASSETS_BASE_URL")));
});
