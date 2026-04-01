/**
 * Session Service — chat session lifecycle, notebook management, and context resolution.
 *
 * Extracted from routes/chat.js to keep route handlers thin.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { config } from "../config.js";
import openNotebook from "../services/open-notebook.service.js";
import { buildLiveContextPrompt } from "../services/live-context.service.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("session");

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

const sessions = new Map();
const notebookBootstrapJobs = new Map();
let postsCorpusCache = null;

// ---------------------------------------------------------------------------
// Session TTL & Garbage Collection
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const SESSION_GC_INTERVAL_MS = 1000 * 60 * 10; // every 10 minutes

const sessionGcInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    const lastActivity =
      session.lastActivityAt || Date.parse(session.createdAt) || 0;
    if (now - lastActivity > SESSION_TTL_MS) {
      sessions.delete(id);
      notebookBootstrapJobs.delete(id);
    }
  }
}, SESSION_GC_INTERVAL_MS);
sessionGcInterval.unref?.();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTEBOOK_BOOTSTRAP = {
  CHUNK_SIZE: 3200,
  CHUNK_OVERLAP: 200,
  MAX_CHUNKS_PER_POST: 80,
};

// Timeout constants — parsed from env, clamped to sane minimums.
const CHAT_NOTEBOOK_CONTEXT_TIMEOUT_MS = Math.max(
  300,
  Number.parseInt(process.env.CHAT_NOTEBOOK_CONTEXT_TIMEOUT_MS || "1800", 10),
);
const CHAT_RAG_CONTEXT_TIMEOUT_MS = Math.max(
  300,
  Number.parseInt(process.env.CHAT_RAG_CONTEXT_TIMEOUT_MS || "2200", 10),
);
const CHAT_LIVE_CONTEXT_MESSAGES = Math.max(
  1,
  Number.parseInt(process.env.CHAT_LIVE_CONTEXT_MESSAGES || "8", 10),
);

// ---------------------------------------------------------------------------
// Dependency injection: performRAGSearch lives in routes/chat.js (RAG infra).
// Set via `setPerformRAGSearch` during init so session service can use it
// inside `resolveMessageContexts` without a circular import.
// ---------------------------------------------------------------------------

let _performRAGSearch = async () => ({ context: null, sources: [] });

export function setPerformRAGSearch(fn) {
  if (typeof fn === "function") {
    _performRAGSearch = fn;
  }
}

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

export function createSession(title = "") {
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessions.set(sessionId, {
    id: sessionId,
    title: title || `Session ${sessionId.slice(-6)}`,
    messages: [],
    createdAt: new Date().toISOString(),
    lastActivityAt: Date.now(),
    notebookId: null,
    notebookReady: false,
    notebookBootstrappedAt: null,
    notebookError: null,
  });
  return sessionId;
}

export function getSession(sessionId) {
  return sessions.get(sessionId);
}

// ---------------------------------------------------------------------------
// Posts corpus helpers
// ---------------------------------------------------------------------------

export function getPostsDirectoryCandidates() {
  const candidates = [];

  if (config.content?.postsDir) {
    candidates.push(config.content.postsDir);
  }

  if (config.content?.publicDir) {
    candidates.push(path.join(config.content.publicDir, "posts"));
  }

  candidates.push(path.resolve(process.cwd(), "../frontend/public/posts"));

  return [...new Set(candidates)];
}

export async function listMarkdownFiles(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;

    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

export function chunkText(text) {
  const chunks = [];
  const chunkSize = NOTEBOOK_BOOTSTRAP.CHUNK_SIZE;
  const overlap = NOTEBOOK_BOOTSTRAP.CHUNK_OVERLAP;

  if (!text || typeof text !== "string") {
    return chunks;
  }

  let cursor = 0;
  while (
    cursor < text.length &&
    chunks.length < NOTEBOOK_BOOTSTRAP.MAX_CHUNKS_PER_POST
  ) {
    const end = Math.min(text.length, cursor + chunkSize);
    const piece = text.slice(cursor, end).trim();
    if (piece) {
      chunks.push(piece);
    }

    if (end >= text.length) break;
    cursor = Math.max(end - overlap, cursor + 1);
  }

  return chunks;
}

export function postMetaFromPath(filePath, rootDir) {
  const rel = path.relative(rootDir, filePath).replace(/\\/g, "/");
  const parts = rel.split("/");

  const year = parts[0] || "";
  const maybeLang = parts[1] === "ko" || parts[1] === "en" ? parts[1] : "";
  const filename = parts[parts.length - 1] || "";
  const slug = filename.replace(/\.md$/i, "");

  return { rel, year, lang: maybeLang, slug };
}

export async function loadPostsCorpus() {
  if (postsCorpusCache) {
    return postsCorpusCache;
  }

  const candidates = getPostsDirectoryCandidates();

  for (const rootDir of candidates) {
    const files = await listMarkdownFiles(rootDir);
    if (files.length === 0) continue;

    const posts = [];
    for (const filePath of files) {
      try {
        const raw = await readFile(filePath, "utf-8");
        const parsed = matter(raw);
        const content = String(parsed.content || "").trim();
        if (!content) continue;

        const meta = postMetaFromPath(filePath, rootDir);
        posts.push({
          title: String(parsed.data?.title || meta.slug || "Untitled"),
          description: String(
            parsed.data?.description || parsed.data?.snippet || "",
          ),
          tags: Array.isArray(parsed.data?.tags)
            ? parsed.data.tags.map(String)
            : [],
          date: String(parsed.data?.date || ""),
          ...meta,
          content,
        });
      } catch {
        // Skip unreadable markdown file.
      }
    }

    if (posts.length > 0) {
      postsCorpusCache = posts;
      return postsCorpusCache;
    }
  }

  postsCorpusCache = [];
  return postsCorpusCache;
}

export function buildCatalogNotes(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return [];
  }

  const notes = [];

  for (const post of posts) {
    const chunks = chunkText(post.content);
    if (chunks.length === 0) continue;

    for (let idx = 0; idx < chunks.length; idx += 1) {
      const header = [
        `Title: ${post.title}`,
        post.slug ? `Slug: ${post.slug}` : null,
        post.year ? `Year: ${post.year}` : null,
        post.lang ? `Lang: ${post.lang}` : null,
        post.date ? `Date: ${post.date}` : null,
        post.tags.length > 0 ? `Tags: ${post.tags.join(", ")}` : null,
        post.description ? `Summary: ${post.description}` : null,
        `SourcePath: ${post.rel}`,
        `Chunk: ${idx + 1}/${chunks.length}`,
      ]
        .filter(Boolean)
        .join("\n");

      notes.push({
        title: `post:${post.slug || post.title}:chunk-${idx + 1}`,
        content: `${header}\n\n${chunks[idx]}`,
      });
    }
  }

  return notes;
}

// ---------------------------------------------------------------------------
// Notebook lifecycle
// ---------------------------------------------------------------------------

export async function bootstrapSessionNotebook(session) {
  const posts = await loadPostsCorpus();
  const notes = buildCatalogNotes(posts);

  if (notes.length === 0) {
    await openNotebook.createNote(
      "No post content was available during notebook bootstrap.",
      {
        title: "blog-catalog-empty",
        notebookId: session.notebookId,
      },
    );
    return;
  }

  for (const note of notes) {
    await openNotebook.createNote(note.content, {
      title: note.title,
      notebookId: session.notebookId,
    });
  }
}

export async function ensureSessionNotebook(sessionId, options = {}) {
  const { waitForBootstrap = false } = options;

  if (!openNotebook.isEnabled()) {
    return null;
  }

  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  if (session.notebookId && session.notebookReady) {
    return session.notebookId;
  }

  if (!session.notebookId) {
    try {
      const notebookName = `chat-${session.id}`;
      const notebookDescription = `Isolated notebook for chat session ${session.id}`;
      const notebook = await openNotebook.createNotebook(
        notebookName,
        notebookDescription,
      );
      session.notebookId = notebook?.id || null;
    } catch (err) {
      session.notebookError = err?.message || "Notebook provisioning failed";
      return null;
    }
  }

  if (!session.notebookId) {
    return null;
  }

  if (notebookBootstrapJobs.has(sessionId)) {
    if (waitForBootstrap) {
      await notebookBootstrapJobs.get(sessionId);
    }
    return session.notebookId || null;
  }

  const job = (async () => {
    if (!session.notebookReady) {
      await bootstrapSessionNotebook(session);
      session.notebookReady = true;
      session.notebookBootstrappedAt = new Date().toISOString();
    }

    return session.notebookId;
  })()
    .catch((err) => {
      session.notebookReady = false;
      session.notebookError = err?.message || "Notebook bootstrap failed";
      throw err;
    })
    .finally(() => {
      notebookBootstrapJobs.delete(sessionId);
    });

  notebookBootstrapJobs.set(sessionId, job);
  if (waitForBootstrap) {
    await job;
  }

  return session.notebookId;
}

export async function buildNotebookContext(query, session) {
  if (!openNotebook.isEnabled() || !session?.id) {
    return null;
  }

  try {
    const notebookId = await ensureSessionNotebook(session.id, {
      waitForBootstrap: false,
    });
    if (!notebookId || session.notebookReady !== true) return null;

    const notebookResult = await openNotebook.ask(query, {
      notebookId,
      timeout: CHAT_NOTEBOOK_CONTEXT_TIMEOUT_MS,
    });
    if (!notebookResult?.answer) return null;

    return `다음은 사용자 세션 전용 노트북 기반 참고 지식입니다:\n\n${notebookResult.answer}`;
  } catch (err) {
    logger.warn({}, 'Open Notebook context build failed', { error: err?.message });
    return null;
  }
}

export async function reinforceSessionNotebook(
  session,
  userMessage,
  assistantMessage,
) {
  if (!openNotebook.isEnabled() || !session?.id) {
    return;
  }

  try {
    const notebookId = await ensureSessionNotebook(session.id);
    if (!notebookId) return;

    const content = [
      `User: ${userMessage}`,
      `Assistant: ${assistantMessage}`,
    ].join("\n\n");

    await openNotebook.createNote(content, {
      title: `chat-turn-${Date.now()}`,
      notebookId,
      noteType: "ai",
    });
  } catch (err) {
    logger.warn({}, 'Open Notebook reinforcement failed', { error: err?.message });
  }
}

// ---------------------------------------------------------------------------
// Context resolution helpers
// ---------------------------------------------------------------------------

export async function withSoftTimeout(promise, timeoutMs, fallbackValue) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallbackValue), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function getLiveContextForSession(sessionId) {
  return buildLiveContextPrompt(sessionId, {
    limit: CHAT_LIVE_CONTEXT_MESSAGES,
    includeAgents: false,
  });
}

export function deriveUserQuery(parts, fallback) {
  if (!Array.isArray(parts)) {
    return String(fallback || "");
  }

  const candidates = parts
    .filter((p) => p?.type === "text")
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .filter((t) => t && !t.startsWith("["));

  return candidates[candidates.length - 1] || fallback;
}

export async function resolveMessageContexts({
  userQuery,
  session,
  enableRag,
  articleSlug = null,
  articleYear = null,
}) {
  const notebookPromise = withSoftTimeout(
    buildNotebookContext(userQuery, session),
    CHAT_NOTEBOOK_CONTEXT_TIMEOUT_MS,
    null,
  ).catch(() => null);

  const ragPromise = enableRag
    ? withSoftTimeout(
        _performRAGSearch(userQuery, 5, articleSlug, articleYear),
        CHAT_RAG_CONTEXT_TIMEOUT_MS,
        { context: null, sources: [] },
      ).catch(() => ({ context: null, sources: [] }))
    : Promise.resolve({ context: null, sources: [] });

  const [notebookContext, ragResult] = await Promise.all([
    notebookPromise,
    ragPromise,
  ]);
  return {
    notebookContext: notebookContext || null,
    ragContext: ragResult?.context || null,
    ragSources: Array.isArray(ragResult?.sources) ? ragResult.sources : [],
  };
}

// ---------------------------------------------------------------------------
// Re-export timeout constants so chat.js route handlers can reference them.
// ---------------------------------------------------------------------------

export {
  CHAT_NOTEBOOK_CONTEXT_TIMEOUT_MS,
  CHAT_RAG_CONTEXT_TIMEOUT_MS,
  CHAT_LIVE_CONTEXT_MESSAGES,
};
