import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "redis";

import { createRedisNotificationStreamAdapter } from "../src/adapters/notifications/redis-notification-stream.adapter.js";

const DEFAULT_REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function createMockResponse() {
  const writes = [];

  return {
    writes,
    res: {
      write(chunk) {
        writes.push(String(chunk));
        return true;
      },
      flush() {},
    },
  };
}

function parseSseChunk(chunk) {
  const lines = String(chunk).trim().split("\n");
  const eventLine = lines.find((line) => line.startsWith("event: "));
  const dataLine = lines.find((line) => line.startsWith("data: "));

  return {
    event: eventLine ? eventLine.slice("event: ".length) : null,
    data: dataLine ? JSON.parse(dataLine.slice("data: ".length)) : null,
  };
}

async function waitFor(assertion, options = {}) {
  const timeoutMs = options.timeoutMs ?? 1500;
  const intervalMs = options.intervalMs ?? 25;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await assertion();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return assertion();
}

function createTrackedRedisClient(url) {
  const publisher = createClient({
    url,
    socket: {
      connectTimeout: 1000,
      reconnectStrategy: () => new Error("redis reconnect disabled for test"),
    },
  });
  const subscribers = new Set();

  publisher.on("error", () => {});

  return {
    async connect() {
      if (!publisher.isOpen) {
        await publisher.connect();
      }
    },
    async publish(channel, message) {
      return publisher.publish(channel, message);
    },
    duplicate() {
      const subscriber = publisher.duplicate();
      subscriber.on("error", () => {});
      subscribers.add(subscriber);
      return subscriber;
    },
    async close() {
      for (const subscriber of subscribers) {
        if (subscriber.isOpen) {
          await subscriber.quit().catch(() => subscriber.disconnect());
        } else {
          subscriber.disconnect();
        }
      }

      if (publisher.isOpen) {
        await publisher.quit().catch(() => publisher.disconnect());
      } else {
        publisher.disconnect();
      }
    },
  };
}

async function createIntegrationRedisClient(t) {
  if (!process.env.REDIS_URL) {
    t.skip("REDIS_URL not set for Redis integration test");
    return null;
  }

  const redisClient = createTrackedRedisClient(DEFAULT_REDIS_URL);

  try {
    await redisClient.connect();
  } catch (error) {
    await redisClient.close().catch(() => {});
    t.skip(`Redis unavailable at ${DEFAULT_REDIS_URL}: ${error?.message || "unknown error"}`);
    return null;
  }

  t.after(async () => {
    await redisClient.close();
  });

  return redisClient;
}

async function waitForUserChannelSubscription(redisClient, responses, userId) {
  const channel = `user:${userId}:notifications`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    for (const response of responses) {
      response.writes.length = 0;
    }

    const probeEvent = `probe_${attempt}`;
    await redisClient.publish(
      channel,
      JSON.stringify({
        eventName: probeEvent,
        data: { attempt },
        targetUserId: userId,
      }),
    );

    try {
      await waitFor(() => {
        assert.equal(responses.length > 0, true);
        for (const response of responses) {
          assert.equal(response.writes.length > 0, true);
          const parsed = parseSseChunk(response.writes.at(-1));
          assert.equal(parsed.event, probeEvent);
        }
      }, { timeoutMs: 300, intervalMs: 25 });

      for (const response of responses) {
        response.writes.length = 0;
      }
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  throw new Error(`Timed out waiting for Redis subscriptions on ${channel}`);
}

test("two adapter instances subscribed to the same user channel both receive a published notification", async (t) => {
  const redisClient = await createIntegrationRedisClient(t);
  if (!redisClient) return;

  const adapterA = createRedisNotificationStreamAdapter(redisClient);
  const adapterB = createRedisNotificationStreamAdapter(redisClient);
  const responseA = createMockResponse();
  const responseB = createMockResponse();
  const userId = `redis-fanout-${Date.now()}`;

  const subA = adapterA.addSubscriber(responseA.res, userId);
  const subB = adapterB.addSubscriber(responseB.res, userId);

  t.after(() => {
    adapterA.removeSubscriber(subA);
    adapterB.removeSubscriber(subB);
  });

  await waitForUserChannelSubscription(redisClient, [responseA, responseB], userId);

  const payload = {
    type: "info",
    title: "Redis fanout",
    message: "Both adapters should receive this notification.",
    payload: { ok: true },
    sourceId: "fanout-test",
  };

  adapterA.broadcast("notification", payload, userId);

  await waitFor(() => {
    assert.equal(responseA.writes.length, 1);
    assert.equal(responseB.writes.length, 1);
  });

  const parsedA = parseSseChunk(responseA.writes[0]);
  const parsedB = parseSseChunk(responseB.writes[0]);

  assert.equal(parsedA.event, "notification");
  assert.deepEqual(parsedA.data, payload);
  assert.deepEqual(parsedB, parsedA);
});

test("adapter degrades gracefully when Redis publish fails", async () => {
  const response = createMockResponse();
  let publishCalls = 0;

  const adapter = createRedisNotificationStreamAdapter({
    async publish() {
      publishCalls += 1;
      throw new Error("publish failed");
    },
    duplicate() {
      return {
        isOpen: true,
        on() {},
        async subscribe() {
          throw new Error("subscribe failed");
        },
        async unsubscribe() {},
      };
    },
  });

  const subId = adapter.addSubscriber(response.res, "user-fallback");

  await new Promise((resolve) => setTimeout(resolve, 0));

  const payload = {
    type: "warn",
    title: "Fallback delivery",
    message: "Redis publish failed, but local SSE delivery should still work.",
    payload: null,
    sourceId: null,
  };

  adapter.broadcast("notification", payload, "user-fallback");

  await waitFor(() => {
    assert.equal(response.writes.length, 1);
  }, { timeoutMs: 500, intervalMs: 10 });

  const parsed = parseSseChunk(response.writes[0]);

  assert.equal(publishCalls, 1);
  assert.equal(parsed.event, "notification");
  assert.deepEqual(parsed.data, payload);

  adapter.removeSubscriber(subId);
  assert.equal(adapter.getSubscriberCount(), 0);
});
