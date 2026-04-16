import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "ai-vision-ssrf-test-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
process.env.APP_ENV = process.env.APP_ENV || "test";
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || "gpt-4.1-mini";

const { assertSafeImageUrl, isPrivateIpAddress } = await import("../src/routes/ai.js");

test("isPrivateIpAddress blocks local and private address ranges", () => {
  assert.equal(isPrivateIpAddress("127.0.0.1"), true);
  assert.equal(isPrivateIpAddress("10.0.0.8"), true);
  assert.equal(isPrivateIpAddress("169.254.169.254"), true);
  assert.equal(isPrivateIpAddress("93.184.216.34"), false);
});

test("assertSafeImageUrl rejects direct private IP targets", async () => {
  await assert.rejects(
    () => assertSafeImageUrl("http://169.254.169.254/latest/meta-data"),
    /Blocked private IP/,
  );
});

test("assertSafeImageUrl rejects hostnames that resolve to private addresses", async () => {
  await assert.rejects(
    () =>
      assertSafeImageUrl("https://example.com/image.png", {
        lookupImpl: async () => [{ address: "10.0.0.5" }],
      }),
    /Blocked private network address/,
  );
});

test("assertSafeImageUrl allows public image hosts", async () => {
  await assert.doesNotReject(() =>
    assertSafeImageUrl("https://example.com/image.png", {
      lookupImpl: async () => [{ address: "93.184.216.34" }],
    }),
  );
});
