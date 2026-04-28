import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "notifications-service-test-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
process.env.APP_ENV = process.env.APP_ENV || "test";
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || "gpt-4.1-mini";

const { createNotificationsService } = await import("../src/services/notifications.service.js");

test("notifications service emits a stable outbox notificationId when no inbox record exists", async () => {
  const broadcasts = [];
  const queued = [];
  const service = createNotificationsService({
    notificationStream: {
      broadcast(eventName, data, targetUserId) {
        broadcasts.push({ eventName, data, targetUserId });
      },
      getSubscriberCount() {
        return 2;
      },
    },
    repository: {
      async getStorageMode() {
        return "memory";
      },
      async listUnread() {
        return { items: [], total: 0 };
      },
      async listHistory() {
        return { items: [], total: 0 };
      },
      async markRead() {
        return null;
      },
      async appendOutbox() {
        return {
          id: "nout-1",
          createdAt: "2026-04-15T00:00:00.000Z",
          broadcastedAt: null,
        };
      },
      async materializeInbox() {
        return null;
      },
      async markOutboxBroadcasted() {},
    },
    broadcastOutbox: {
      async append(input) {
        queued.push(input);
        return { id: "dout-1", ...input };
      },
    },
  });

  const result = await service.deliver({
    eventName: "notification",
    type: "info",
    title: "Stable ID",
    message: "Uses outbox ID when inbox is absent",
  });

  assert.equal(result.delivered, 0);
  assert.equal(result.broadcastQueued, true);
  assert.equal(broadcasts.length, 0);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].payload.data.notificationId, "nout-1");
  assert.equal(queued[0].payload.data.outboxId, "nout-1");
});

test("notifications service does not rebroadcast when appendOutbox returns an already-broadcasted dedupe hit", async () => {
  let markBroadcastedCalled = false;
  let broadcastCalled = false;
  let outboxAppendCalled = false;
  const service = createNotificationsService({
    notificationStream: {
      broadcast() {
        broadcastCalled = true;
      },
      getSubscriberCount() {
        return 1;
      },
    },
    repository: {
      async getStorageMode() {
        return "memory";
      },
      async listUnread() {
        return { items: [], total: 0 };
      },
      async listHistory() {
        return { items: [], total: 0 };
      },
      async markRead() {
        return null;
      },
      async appendOutbox() {
        return {
          id: "nout-2",
          createdAt: "2026-04-15T00:00:00.000Z",
          broadcastedAt: "2026-04-15T00:00:01.000Z",
        };
      },
      async materializeInbox() {
        return null;
      },
      async markOutboxBroadcasted() {
        markBroadcastedCalled = true;
      },
    },
    broadcastOutbox: {
      async append() {
        outboxAppendCalled = true;
        return null;
      },
    },
  });

  const result = await service.deliver({
    eventName: "notification",
    type: "info",
    title: "Deduped",
    message: "Do not broadcast again",
    dedupeKey: "same-event",
  });

  assert.equal(result.delivered, 0);
  assert.equal(result.deduped, true);
  assert.equal(broadcastCalled, false);
  assert.equal(outboxAppendCalled, false);
  assert.equal(markBroadcastedCalled, false);
});
