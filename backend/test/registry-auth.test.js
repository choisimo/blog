import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "registry-auth-test-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
process.env.APP_ENV = process.env.APP_ENV || "test";
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || "gpt-4.1-mini";

const { getProtectedRouteRegistry } = await import("../src/routes/registry.js");

test("backend legacy auth routes are not mounted in the protected registry", () => {
  const routes = getProtectedRouteRegistry();
  assert.equal(routes.some((route) => route.boundaryId === "auth"), false);
});
