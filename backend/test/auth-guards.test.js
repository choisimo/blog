import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "auth-guards-test-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
process.env.APP_ENV = process.env.APP_ENV || "test";
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || "gpt-4.1-mini";

const [
  { config, getSecurityConfigurationErrors },
  { requireAdmin },
  { requireBackendKey },
  { requireGatewaySignature },
] = await Promise.all([
  import("../src/config/index.js"),
  import("../src/middleware/adminAuth.js"),
  import("../src/middleware/backendAuth.js"),
  import("../src/middleware/gatewaySignature.js"),
]);

function createResponseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function cloneSecurityConfig() {
  return {
    backendKey: config.backendKey,
    security: { ...config.security },
    admin: { ...config.admin },
    auth: { ...config.auth },
  };
}

function restoreSecurityConfig(snapshot) {
  config.backendKey = snapshot.backendKey;
  config.security = snapshot.security;
  config.admin = snapshot.admin;
  config.auth = snapshot.auth;
}

async function withSecurityConfig(patch, callback) {
  const snapshot = cloneSecurityConfig();
  try {
    Object.assign(config, patch);
    if (patch.security) config.security = { ...snapshot.security, ...patch.security };
    if (patch.admin) config.admin = { ...snapshot.admin, ...patch.admin };
    if (patch.auth) config.auth = { ...snapshot.auth, ...patch.auth };
    await callback();
  } finally {
    restoreSecurityConfig(snapshot);
  }
}

test("backend key guard fails closed unless insecure development auth is explicitly allowed", async () => {
  await withSecurityConfig(
    {
      backendKey: undefined,
      security: { protectedEnvironment: false, allowInsecureDevAuth: false },
    },
    () => {
      const req = { method: "GET", path: "/api/v1/posts", headers: {}, ip: "127.0.0.1" };
      const res = createResponseRecorder();
      let nextCalled = false;

      requireBackendKey(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 503);
      assert.deepEqual(res.payload, { ok: false, error: "Service unavailable" });
    },
  );
});

test("backend key guard allows explicit insecure development opt-in", async () => {
  await withSecurityConfig(
    {
      backendKey: undefined,
      security: { protectedEnvironment: false, allowInsecureDevAuth: true },
    },
    () => {
      const req = { method: "GET", path: "/api/v1/posts", headers: {}, ip: "127.0.0.1" };
      const res = createResponseRecorder();
      let nextCalled = false;

      requireBackendKey(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(res.statusCode, 200);
    },
  );
});

test("admin guard fails closed when no admin credential source is configured", async () => {
  await withSecurityConfig(
    {
      security: { protectedEnvironment: false, allowInsecureDevAuth: false },
      admin: { bearerToken: undefined },
      auth: { jwtSecret: undefined },
    },
    () => {
      const req = { headers: {} };
      const res = createResponseRecorder();
      let nextCalled = false;

      requireAdmin(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 503);
      assert.deepEqual(res.payload, { ok: false, error: "Service unavailable" });
    },
  );
});

test("protected security configuration requires backend and JWT secrets", () => {
  const errors = getSecurityConfigurationErrors({
    backendKey: undefined,
    security: { protectedEnvironment: true, allowInsecureDevAuth: false },
    admin: { bearerToken: undefined },
    auth: { jwtSecret: undefined },
  });

  assert.ok(errors.includes("BACKEND_KEY is required in protected environments"));
  assert.ok(errors.includes("JWT_SECRET is required in protected environments"));
  assert.ok(
    errors.includes(
      "ADMIN_BEARER_TOKEN or JWT_SECRET is required for admin routes in protected environments",
    ),
  );
  assert.ok(errors.includes("GATEWAY_SIGNING_SECRET is required in protected environments"));
});

test("gateway signature guard can reject backend-key-only origin requests", async () => {
  await withSecurityConfig(
    {
      backendKey: "backend-key",
      security: {
        protectedEnvironment: true,
        allowInsecureDevAuth: false,
        gatewaySigningSecret: "gateway-signing-secret",
      },
    },
    () => {
      const req = {
        method: "GET",
        path: "/api/v1/posts",
        originalUrl: "/api/v1/posts",
        headers: { "x-backend-key": "backend-key" },
      };
      const res = createResponseRecorder();
      let nextCalled = false;

      requireGatewaySignature({ allowBackendKey: false })(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.equal(res.payload.error.code, "MISSING_GATEWAY_SIGNATURE");
    },
  );
});

test("protected OAuth configuration requires an admin email allowlist", () => {
  const errors = getSecurityConfigurationErrors({
    backendKey: "backend-key",
    security: {
      protectedEnvironment: true,
      allowInsecureDevAuth: false,
      gatewaySigningSecret: "gateway-signing-secret",
    },
    admin: { bearerToken: undefined },
    auth: { jwtSecret: "jwt-secret" },
    oauth: {
      googleClientId: "google-client-id",
      googleClientSecret: "google-client-secret",
      allowedEmails: "",
    },
  });

  assert.ok(
    errors.includes("ADMIN_ALLOWED_EMAILS is required for OAuth in protected environments"),
  );
});
