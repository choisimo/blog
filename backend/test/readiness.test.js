import test from "node:test";
import assert from "node:assert/strict";

import {
  buildHealthPayload,
  buildReadinessResponse,
  markReadinessDegraded,
  resetReadinessState,
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
