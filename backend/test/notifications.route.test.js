import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "notifications-route-test-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
process.env.APP_ENV = process.env.APP_ENV || "test";
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || "gpt-4.1-mini";

const { buildNotificationStreamReadyFrame } = await import("../src/routes/notifications.js");

test("notification stream ready frame is a keepalive ping, not an ID-less notification", () => {
  const frame = buildNotificationStreamReadyFrame();

  assert.match(frame, /^event: ping\n/);
  assert.match(frame, /\n\ndata:|\ndata:/);
  assert.equal(frame.includes("event: notification"), false);
  assert.equal(frame.includes("알림 연결됨"), false);
});
