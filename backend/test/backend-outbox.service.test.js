import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "backend-outbox-test-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
process.env.APP_ENV = process.env.APP_ENV || "test";
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || "gpt-4.1-mini";
process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || "github-test-token";
process.env.GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || "owner";
process.env.GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || "repo";

const {
  DEPLOYMENT_HOOK_STREAM,
  GITHUB_PR_STREAM,
  NOTIFICATION_BROADCAST_STREAM,
  flushBackendDomainOutbox,
} = await import("../src/services/backend-outbox.service.js");

class FakeRepository {
  constructor(events) {
    this.events = events.map((event) => ({ status: "pending", ...event }));
    this.succeeded = [];
    this.failed = [];
  }

  async claimPending({ stream }) {
    const claimed = this.events.filter((event) => event.stream === stream && event.status === "pending");
    for (const event of claimed) event.status = "processing";
    return claimed;
  }

  async markSucceeded(id) {
    this.succeeded.push(id);
    return { id, status: "succeeded" };
  }

  async markFailed(id, { error } = {}) {
    this.failed.push({ id, error });
    return { id, status: "failed", error };
  }
}

test("backend outbox flush posts deployment hooks and marks the event succeeded", async () => {
  const repository = new FakeRepository([
    {
      id: "dout-deploy",
      stream: DEPLOYMENT_HOOK_STREAM,
      aggregateId: "deploy-1",
      eventType: "vercel.deploy.requested",
      idempotencyKey: "deploy-key",
      payload: { url: "https://deploy.example/hook", reason: "test" },
    },
  ]);
  const calls = [];

  const result = await flushBackendDomainOutbox({
    repository,
    streams: DEPLOYMENT_HOOK_STREAM,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response("ok", { status: 200 });
    },
  });

  assert.equal(result.processed, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(repository.succeeded, ["dout-deploy"]);
  assert.equal(calls[0].url, "https://deploy.example/hook");
  assert.equal(calls[0].init.headers["Idempotency-Key"], "deploy-key");
});

test("backend outbox creates GitHub PRs with idempotent branch/file/PR operations", async () => {
  const repository = new FakeRepository([
    {
      id: "dout-pr",
      stream: GITHUB_PR_STREAM,
      aggregateId: "post:2026:test",
      eventType: "github.pr.create-post",
      payload: {
        branch: "post/2026-test-202604270101",
        path: "frontend/public/posts/2026/test.md",
        markdown: "# Test\n",
        commitMessage: "feat(post): add test",
        prTitle: "Add test",
        prBody: "body",
      },
    },
  ]);
  const calls = [];
  const notFound = () => Object.assign(new Error("not found"), { status: 404 });
  const fakeOctokit = {
    rest: {
      repos: {
        get: async () => ({ data: { default_branch: "main" } }),
        getContent: async () => {
          throw notFound();
        },
        createOrUpdateFileContents: async (input) => {
          calls.push(["file", input]);
          return { data: {} };
        },
      },
      git: {
        getRef: async ({ ref }) => {
          if (ref === "heads/main") return { data: { object: { sha: "base-sha" } } };
          throw notFound();
        },
        createRef: async (input) => {
          calls.push(["branch", input]);
          return { data: {} };
        },
      },
      pulls: {
        list: async () => ({ data: [] }),
        create: async (input) => {
          calls.push(["pr", input]);
          return { data: { html_url: "https://github.example/pr/1" } };
        },
      },
    },
  };

  const result = await flushBackendDomainOutbox({
    repository,
    streams: GITHUB_PR_STREAM,
    octokitFactory: () => fakeOctokit,
  });

  assert.equal(result.processed, 1);
  assert.equal(result.results[0].result.prUrl, "https://github.example/pr/1");
  assert.deepEqual(calls.map(([kind]) => kind), ["branch", "file", "pr"]);
});

test("backend outbox broadcasts notifications and marks the notification outbox row", async () => {
  const repository = new FakeRepository([
    {
      id: "dout-notification",
      stream: NOTIFICATION_BROADCAST_STREAM,
      aggregateId: "nout-1",
      eventType: "notification.broadcast",
      payload: {
        outboxId: "nout-1",
        eventName: "notification",
        targetUserId: "user-1",
        data: { notificationId: "nout-1", title: "Queued" },
      },
    },
  ]);
  const broadcasts = [];
  const marked = [];

  const result = await flushBackendDomainOutbox({
    repository,
    streams: NOTIFICATION_BROADCAST_STREAM,
    notificationStream: {
      broadcast(eventName, data, targetUserId) {
        broadcasts.push({ eventName, data, targetUserId });
      },
      getSubscriberCount() {
        return 3;
      },
    },
    notificationsRepository: {
      async claimOutboxForBroadcast(id) {
        return { id, deliveryStatus: "broadcasting" };
      },
      async markOutboxBroadcasted(id) {
        marked.push(id);
      },
      async markOutboxBroadcastFailed() {
        throw new Error("unexpected failure mark");
      },
    },
  });

  assert.equal(result.processed, 1);
  assert.deepEqual(marked, ["nout-1"]);
  assert.deepEqual(broadcasts, [
    {
      eventName: "notification",
      data: { notificationId: "nout-1", title: "Queued" },
      targetUserId: "user-1",
    },
  ]);
});

test("backend outbox does not retry notification broadcast when only mark-broadcasted fails", async () => {
  const repository = new FakeRepository([
    {
      id: "dout-notification-mark-fail",
      stream: NOTIFICATION_BROADCAST_STREAM,
      aggregateId: "nout-mark-fail",
      eventType: "notification.broadcast",
      payload: {
        outboxId: "nout-mark-fail",
        eventName: "notification",
        data: { notificationId: "nout-mark-fail", title: "Queued" },
      },
    },
  ]);
  let broadcasts = 0;

  const result = await flushBackendDomainOutbox({
    repository,
    streams: NOTIFICATION_BROADCAST_STREAM,
    notificationStream: {
      broadcast() {
        broadcasts += 1;
      },
      getSubscriberCount() {
        return 1;
      },
    },
    notificationsRepository: {
      async claimOutboxForBroadcast(id) {
        return { id, deliveryStatus: "broadcasting" };
      },
      async markOutboxBroadcasted() {
        throw new Error("state write failed");
      },
      async markOutboxBroadcastFailed() {
        throw new Error("unexpected failure mark");
      },
    },
  });

  assert.equal(result.processed, 1);
  assert.equal(result.failed, 0);
  assert.equal(broadcasts, 1);
  assert.deepEqual(repository.succeeded, ["dout-notification-mark-fail"]);
  assert.deepEqual(repository.failed, []);
  assert.equal(result.results[0].result.statePersisted, false);
});
