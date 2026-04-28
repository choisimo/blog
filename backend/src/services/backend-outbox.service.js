import { Octokit } from "@octokit/rest";
import { config } from "../config.js";
import { aiService } from "../lib/ai-service.js";
import { execute, isD1Configured } from "../lib/d1.js";
import { openaiEmbeddings } from "../lib/openai-compat-client.js";
import { getApplicationContainer } from "../application/bootstrap/container.js";
import {
  getDomainOutboxRepository,
} from "../repositories/domain-outbox.repository.js";
import { getNotificationsRepository } from "../repositories/notifications.repository.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("backend-outbox-service");

export const GITHUB_PR_STREAM = "github.pr";
export const DEPLOYMENT_HOOK_STREAM = "deployment.hook";
export const IMAGE_VISION_STREAM = "image.vision";
export const RAG_CHROMA_STREAM = "rag.chroma";
export const NOTIFICATION_BROADCAST_STREAM = "notifications.broadcast";

const DEFAULT_STREAMS = [
  GITHUB_PR_STREAM,
  DEPLOYMENT_HOOK_STREAM,
  IMAGE_VISION_STREAM,
  RAG_CHROMA_STREAM,
  NOTIFICATION_BROADCAST_STREAM,
];
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_CONSUMER_ID = `backend-outbox-${process.pid}`;
const CHROMA_TENANT = "default_tenant";
const CHROMA_DATABASE = "default_database";
const collectionUUIDCache = new Map();

function clampLimit(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function normalizeStreams(streams) {
  if (!streams) return DEFAULT_STREAMS;
  const list = Array.isArray(streams) ? streams : [streams];
  const normalized = list.map((stream) => String(stream || "").trim()).filter(Boolean);
  return normalized.length ? normalized : DEFAULT_STREAMS;
}

function assertGitHubConfigured() {
  const { owner, repo, token } = config.github || {};
  if (!owner || !repo || !token) {
    throw new Error("Server not configured for GitHub (owner/repo/token missing)");
  }
  return { owner, repo, token };
}

function getGitIdentity() {
  if (config.github?.gitUserName && config.github?.gitUserEmail) {
    return {
      name: config.github.gitUserName,
      email: config.github.gitUserEmail,
    };
  }
  return undefined;
}

function createOctokit(octokitFactory) {
  const { token } = assertGitHubConfigured();
  return octokitFactory ? octokitFactory(token) : new Octokit({ auth: token });
}

function getChromaCollectionsBase() {
  return `${config.rag.chromaUrl}/api/v2/tenants/${CHROMA_TENANT}/databases/${CHROMA_DATABASE}/collections`;
}

async function getCollectionUUID(collectionName, fetchImpl = fetch) {
  if (collectionUUIDCache.has(collectionName)) {
    return collectionUUIDCache.get(collectionName);
  }

  const response = await fetchImpl(getChromaCollectionsBase(), { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to list collections: ${response.status}`);
  }

  const collections = await response.json();
  const collection = Array.isArray(collections)
    ? collections.find((item) => item.name === collectionName)
    : null;
  if (!collection) return null;

  collectionUUIDCache.set(collectionName, collection.id);
  return collection.id;
}

async function ensureCollection(collectionName, fetchImpl = fetch) {
  let uuid = await getCollectionUUID(collectionName, fetchImpl);
  if (uuid) return uuid;

  const response = await fetchImpl(getChromaCollectionsBase(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: collectionName,
      metadata: { "hnsw:space": "cosine" },
    }),
  });

  if (!response.ok && response.status !== 409) {
    const text = await response.text();
    throw new Error(`Failed to create collection: ${response.status} - ${text}`);
  }

  if (response.ok) {
    const created = await response.json();
    if (created?.id) {
      collectionUUIDCache.set(collectionName, created.id);
      return created.id;
    }
  }

  uuid = await getCollectionUUID(collectionName, fetchImpl);
  if (!uuid) throw new Error(`Failed to get UUID for collection: ${collectionName}`);
  return uuid;
}

async function getEmbeddings(texts) {
  const result = await openaiEmbeddings(texts, {
    model: config.rag.embeddingModel,
    baseUrl: config.rag.embeddingUrl,
    apiKey: config.rag.embeddingApiKey,
  });
  return result.embeddings;
}

async function upsertToChroma(collectionName, ids, embeddings, documents, metadatas, fetchImpl = fetch) {
  const collectionUUID = await ensureCollection(collectionName, fetchImpl);
  const response = await fetchImpl(`${getChromaCollectionsBase()}/${collectionUUID}/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, embeddings, documents, metadatas }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ChromaDB upsert error: ${response.status} - ${text}`);
  }
}

async function deleteFromChroma(collectionName, ids, fetchImpl = fetch) {
  const collectionUUID = await getCollectionUUID(collectionName, fetchImpl);
  if (!collectionUUID) return;

  const response = await fetchImpl(`${getChromaCollectionsBase()}/${collectionUUID}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ChromaDB delete error: ${response.status} - ${text}`);
  }
}

async function getDefaultBranch(octokit, owner, repo) {
  const repoInfo = await octokit.rest.repos.get({ owner, repo });
  return repoInfo.data.default_branch || "main";
}

async function ensureBranch(octokit, { owner, repo, baseBranch, branch }) {
  try {
    await octokit.rest.git.getRef({ owner, repo, ref: `heads/${branch}` });
    return;
  } catch (error) {
    if (error?.status !== 404) throw error;
  }

  const baseRef = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha: baseRef.data.object.sha,
  });
}

async function ensureFile(octokit, { owner, repo, path, branch, message, content }) {
  let sha;
  try {
    const existing = await octokit.rest.repos.getContent({ owner, repo, path, ref: branch });
    if (!Array.isArray(existing.data)) {
      sha = existing.data.sha;
    }
  } catch (error) {
    if (error?.status !== 404) throw error;
  }

  const identity = getGitIdentity();
  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch,
    sha,
    committer: identity,
    author: identity,
  });
}

async function ensurePullRequest(octokit, { owner, repo, title, head, base, body }) {
  const headRef = `${owner}:${head}`;
  const existing = await octokit.rest.pulls.list({
    owner,
    repo,
    head: headRef,
    base,
    state: "open",
    per_page: 1,
  });
  if (existing.data?.[0]) {
    return existing.data[0];
  }

  const created = await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    head,
    base,
    body,
  });
  return created.data;
}

async function processGithubPr(event, { octokitFactory } = {}) {
  if (event.eventType === "github.comments.archive") {
    return processGithubCommentsArchive(event, { octokitFactory });
  }

  const payload = event.payload || {};
  const { owner, repo } = assertGitHubConfigured();
  const octokit = createOctokit(octokitFactory);
  const baseBranch = payload.baseBranch || await getDefaultBranch(octokit, owner, repo);

  if (!payload.branch || !payload.path || !payload.markdown || !payload.prTitle) {
    throw new Error("GitHub PR outbox payload is incomplete");
  }

  await ensureBranch(octokit, {
    owner,
    repo,
    baseBranch,
    branch: payload.branch,
  });
  await ensureFile(octokit, {
    owner,
    repo,
    path: payload.path,
    branch: payload.branch,
    message: payload.commitMessage || payload.prTitle,
    content: payload.markdown,
  });
  const pr = await ensurePullRequest(octokit, {
    owner,
    repo,
    title: payload.prTitle,
    head: payload.branch,
    base: baseBranch,
    body: payload.prBody || "",
  });

  return {
    prUrl: pr.html_url,
    branch: payload.branch,
    path: payload.path,
  };
}

async function processGithubCommentsArchive(event, { octokitFactory } = {}) {
  const payload = event.payload || {};
  const { owner, repo } = assertGitHubConfigured();
  const archives = Array.isArray(payload.archives) ? payload.archives : [];
  if (!archives.length) return { archivedPosts: [], totalComments: 0 };

  const octokit = createOctokit(octokitFactory);
  const baseBranch = payload.baseBranch || await getDefaultBranch(octokit, owner, repo);
  const identity = getGitIdentity();
  const archivedPosts = [];
  let totalComments = 0;

  for (const archive of archives) {
    if (!archive.path || !archive.content || !Array.isArray(archive.commentIds)) {
      throw new Error("Comment archive payload is incomplete");
    }

    let sha;
    try {
      const existing = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: archive.path,
        ref: baseBranch,
      });
      if (!Array.isArray(existing.data)) sha = existing.data.sha;
    } catch (error) {
      if (error?.status !== 404) throw error;
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: archive.path,
      message: archive.message || `chore(archive): comments for ${archive.postId}`,
      content: Buffer.from(archive.content, "utf8").toString("base64"),
      branch: baseBranch,
      committer: identity,
      author: identity,
      sha,
    });

    const ids = archive.commentIds.map((id) => String(id)).filter(Boolean);
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      await execute(
        `UPDATE comments SET archived = 1, updated_at = datetime('now') WHERE id IN (${placeholders})`,
        ...ids,
      );
    }

    totalComments += ids.length;
    archivedPosts.push({
      postId: archive.postId,
      count: ids.length,
      path: archive.path,
    });
  }

  if (payload.deployHookUrl) {
    await getDomainOutboxRepository().append({
      stream: DEPLOYMENT_HOOK_STREAM,
      aggregateId: `comments-archive:${payload.cutoffIso || event.id}`,
      eventType: "vercel.deploy.requested",
      payload: {
        url: payload.deployHookUrl,
        reason: "comments-archive",
        archivedPosts: archivedPosts.map((item) => item.postId),
      },
      idempotencyKey: `vercel.deploy:comments-archive:${payload.cutoffIso || event.id}`,
    });
  }

  return { archivedPosts, totalComments };
}

async function processDeploymentHook(event, { fetchImpl = fetch } = {}) {
  const payload = event.payload || {};
  if (!payload.url) throw new Error("Deployment hook URL is required");

  const response = await fetchImpl(payload.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": event.idempotencyKey || event.id,
    },
    body: JSON.stringify({
      ...payload,
      reason: payload.reason || event.eventType,
      aggregateId: event.aggregateId,
      eventId: event.id,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Deployment hook failed: ${response.status} ${text}`.trim());
  }
  return { status: response.status };
}

async function ensureImageVisionSchema() {
  if (!isD1Configured()) return false;
  await execute(
    `CREATE TABLE IF NOT EXISTS image_vision_results (
      r2_key TEXT PRIMARY KEY,
      outbox_id TEXT NOT NULL,
      image_url TEXT,
      mime_type TEXT,
      model TEXT,
      prompt TEXT,
      description TEXT,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
  return true;
}

async function storeImageVisionResult(input) {
  if (!await ensureImageVisionSchema()) return;
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO image_vision_results (
       r2_key, outbox_id, image_url, mime_type, model, prompt, description,
       status, error, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(r2_key) DO UPDATE SET
       outbox_id = excluded.outbox_id,
       image_url = excluded.image_url,
       mime_type = excluded.mime_type,
       model = excluded.model,
       prompt = excluded.prompt,
       description = excluded.description,
       status = excluded.status,
       error = excluded.error,
       updated_at = excluded.updated_at`,
    input.key,
    input.outboxId,
    input.url || null,
    input.mimeType || null,
    input.model || null,
    input.prompt || null,
    input.description || null,
    input.status,
    input.error || null,
    now,
    now,
  );
}

async function processImageVision(event, { visionService = aiService } = {}) {
  const payload = event.payload || {};
  if (!payload.url || !payload.key) {
    throw new Error("Image vision payload requires url and key");
  }

  try {
    const description = await visionService.vision(payload.url, payload.prompt || "", {
      mimeType: payload.mimeType,
      model: payload.model,
    });
    await storeImageVisionResult({
      outboxId: event.id,
      key: payload.key,
      url: payload.url,
      mimeType: payload.mimeType,
      model: payload.model,
      prompt: payload.prompt,
      description,
      status: "succeeded",
    });
    return { key: payload.key, stored: true };
  } catch (error) {
    await storeImageVisionResult({
      outboxId: event.id,
      key: payload.key,
      url: payload.url,
      mimeType: payload.mimeType,
      model: payload.model,
      prompt: payload.prompt,
      status: "failed",
      error: error?.message || "vision failed",
    });
    throw error;
  }
}

async function processRagChroma(event, { fetchImpl = fetch } = {}) {
  const payload = event.payload || {};
  const collectionName = payload.collection || config.rag.chromaCollection;

  if (event.eventType === "rag.chroma.index") {
    const documents = Array.isArray(payload.documents) ? payload.documents : [];
    if (!documents.length) return { indexed: 0, collection: collectionName };

    const texts = documents.map((document) => String(document.content || ""));
    const embeddings = await getEmbeddings(texts);
    const ids = documents.map((document) => String(document.id));
    const metadatas = documents.map((document) => ({
      ...(document.metadata && typeof document.metadata === "object" ? document.metadata : {}),
      indexed_at: new Date().toISOString(),
    }));
    await upsertToChroma(collectionName, ids, embeddings, texts, metadatas, fetchImpl);
    return { indexed: ids.length, collection: collectionName };
  }

  if (event.eventType === "rag.chroma.delete") {
    const ids = Array.isArray(payload.ids) ? payload.ids : [payload.id].filter(Boolean);
    await deleteFromChroma(collectionName, ids.map(String), fetchImpl);
    return { deleted: ids.length, collection: collectionName };
  }

  throw new Error(`Unsupported RAG Chroma event type: ${event.eventType}`);
}

async function processNotificationBroadcast(
  event,
  {
    notificationStream = getApplicationContainer().ports.notificationStream,
    notificationsRepository = getNotificationsRepository(),
  } = {},
) {
  const payload = event.payload || {};
  if (!payload.outboxId || !payload.eventName || !payload.data) {
    throw new Error("Notification broadcast payload is incomplete");
  }

  const claimed = await notificationsRepository.claimOutboxForBroadcast(payload.outboxId);
  if (!claimed) {
    return {
      outboxId: payload.outboxId,
      skipped: true,
      reason: "not-claimable",
    };
  }

  try {
    notificationStream.broadcast(
      payload.eventName,
      payload.data,
      payload.targetUserId || undefined,
    );
  } catch (error) {
    await notificationsRepository.markOutboxBroadcastFailed(payload.outboxId, error).catch(() => {});
    throw error;
  }

  let statePersisted = true;
  try {
    await notificationsRepository.markOutboxBroadcasted(payload.outboxId);
  } catch (error) {
    statePersisted = false;
    logger.warn({}, "Notification broadcast delivered but state persist failed", {
      outboxId: payload.outboxId,
      error: error?.message,
    });
  }

  return {
    outboxId: payload.outboxId,
    delivered: notificationStream.getSubscriberCount?.() ?? 0,
    statePersisted,
  };
}

async function processEvent(event, options) {
  if (event.stream === GITHUB_PR_STREAM) return processGithubPr(event, options);
  if (event.stream === DEPLOYMENT_HOOK_STREAM) return processDeploymentHook(event, options);
  if (event.stream === IMAGE_VISION_STREAM) return processImageVision(event, options);
  if (event.stream === RAG_CHROMA_STREAM) return processRagChroma(event, options);
  if (event.stream === NOTIFICATION_BROADCAST_STREAM) return processNotificationBroadcast(event, options);
  throw new Error(`Unsupported backend outbox stream: ${event.stream}`);
}

export async function flushBackendDomainOutbox(options = {}) {
  const repository = options.repository || getDomainOutboxRepository();
  const streams = normalizeStreams(options.streams);
  const limit = clampLimit(options.limit);
  const consumerId = options.consumerId || DEFAULT_CONSUMER_ID;
  const results = [];

  for (const stream of streams) {
    const events = await repository.claimPending({ stream, consumerId, limit });
    for (const event of events) {
      try {
        const result = await processEvent(event, options);
        await repository.markSucceeded(event.id);
        results.push({ id: event.id, stream, status: "succeeded", result });
      } catch (error) {
        await repository.markFailed(event.id, { error: error?.message });
        results.push({
          id: event.id,
          stream,
          status: "failed",
          error: error?.message || "backend outbox event failed",
        });
      }
    }
  }

  return {
    ok: results.every((item) => item.status === "succeeded"),
    processed: results.filter((item) => item.status === "succeeded").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  };
}

export function startBackendDomainOutboxWorker(options = {}) {
  const enabled = options.enabled ?? process.env.BACKEND_DOMAIN_OUTBOX_ENABLED !== "false";
  const intervalMs = Number.parseInt(
    String(options.intervalMs ?? process.env.BACKEND_DOMAIN_OUTBOX_INTERVAL_MS ?? "30000"),
    10,
  );
  if (!enabled || !Number.isFinite(intervalMs) || intervalMs <= 0) {
    return { stop() {}, runOnce: () => flushBackendDomainOutbox(options) };
  }

  let running = false;
  let stopped = false;
  const runOnce = async () => {
    if (running || stopped) return null;
    running = true;
    try {
      return await flushBackendDomainOutbox(options);
    } catch (error) {
      logger.warn({}, "Backend domain outbox flush failed", { error: error?.message });
      return null;
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    runOnce().catch(() => {});
  }, intervalMs);
  timer.unref?.();

  return {
    runOnce,
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
