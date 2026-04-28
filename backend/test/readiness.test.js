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
