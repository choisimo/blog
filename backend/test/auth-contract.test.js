import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "auth-contract-test-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
process.env.APP_ENV = process.env.APP_ENV || "test";
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || "gpt-4.1-mini";

const [{ signJwt, verifyJwt }, { requireUserAuth }] = await Promise.all([
  import("../src/lib/jwt.js"),
  import("../src/middleware/userAuth.js"),
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

test("backend JWTs include canonical issuer and audience claims", () => {
  const token = signJwt({
    sub: "user-1",
    role: "user",
    type: "access",
  });

  const claims = verifyJwt(token);
  assert.equal(claims.iss, "blog-api-gateway");
  assert.equal(claims.aud, "blog-platform");
});

test("backend verifyJwt rejects legacy tokens without issuer and audience", () => {
  const legacyToken = jwt.sign(
    {
      sub: "user-1",
      role: "user",
      type: "access",
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  assert.throws(() => verifyJwt(legacyToken), {
    name: "JsonWebTokenError",
    message: "Invalid token issuer",
  });
});

test("requireUserAuth rejects refresh tokens", () => {
  const token = signJwt({
    sub: "user-1",
    role: "user",
    type: "refresh",
  });

  const req = {
    headers: {
      authorization: `Bearer ${token}`,
    },
  };
  const res = createResponseRecorder();
  let nextCalled = false;

  requireUserAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.payload, {
    ok: false,
    error: "Unauthorized - Invalid token type",
  });
});

test("requireUserAuth accepts canonical anonymous access tokens", () => {
  const token = signJwt({
    sub: "anon-user-1",
    role: "anonymous",
    userId: "anon-user-1",
    type: "access",
    tokenClass: "anonymous",
  });

  const req = {
    headers: {
      authorization: `Bearer ${token}`,
    },
  };
  const res = createResponseRecorder();
  let nextCalled = false;

  requireUserAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.userId, "anon-user-1");
  assert.equal(req.userClaims.role, "anonymous");
});
