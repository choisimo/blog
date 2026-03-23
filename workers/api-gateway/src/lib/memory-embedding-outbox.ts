import type { Env } from '../types';
import {
  appendDomainOutboxEvent,
  listDomainOutboxEvents,
  markDomainOutboxPending,
  markDomainOutboxProcessed,
} from './domain-outbox';

const MEMORY_EMBEDDING_STREAM = 'memory.embedding';

type MemoryEmbeddingUpsertPayload = {
  userId: string;
  memoryId: string;
  content: string;
  memoryType: string;
  category?: string | null;
};

type MemoryEmbeddingDeletePayload = {
  userId: string;
  memoryId: string;
};

async function requireBackend(env: Env) {
  if (!env.BACKEND_ORIGIN) {
    throw new Error('BACKEND_ORIGIN not configured');
  }

  return {
    backendOrigin: env.BACKEND_ORIGIN.replace(/\/$/, ''),
    backendKey: env.BACKEND_KEY,
  };
}

async function upsertMemoryEmbedding(
  env: Env,
  payload: MemoryEmbeddingUpsertPayload
) {
  const { backendOrigin, backendKey } = await requireBackend(env);
  const response = await fetch(`${backendOrigin}/api/v1/rag/memories/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(backendKey ? { 'X-Backend-Key': backendKey } : {}),
    },
    body: JSON.stringify({
      userId: payload.userId,
      memories: [
        {
          id: payload.memoryId,
          content: payload.content,
          memoryType: payload.memoryType,
          category: payload.category || undefined,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Memory embedding upsert failed: ${response.status}`);
  }
}

async function deleteMemoryEmbedding(
  env: Env,
  payload: MemoryEmbeddingDeletePayload
) {
  const { backendOrigin, backendKey } = await requireBackend(env);
  const response = await fetch(
    `${backendOrigin}/api/v1/rag/memories/${payload.userId}/${payload.memoryId}`,
    {
      method: 'DELETE',
      headers: backendKey ? { 'X-Backend-Key': backendKey } : undefined,
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Memory embedding delete failed: ${response.status}`);
  }
}

export async function enqueueMemoryEmbeddingUpsert(
  env: Env,
  payload: MemoryEmbeddingUpsertPayload,
  updatedAt: string
) {
  return appendDomainOutboxEvent(env.DB, {
    stream: MEMORY_EMBEDDING_STREAM,
    aggregateId: payload.memoryId,
    eventType: 'memory.embedding.upsert',
    payload,
    idempotencyKey: `memory.embedding.upsert:${payload.memoryId}:${updatedAt}`,
  });
}

export async function enqueueMemoryEmbeddingDelete(
  env: Env,
  payload: MemoryEmbeddingDeletePayload,
  updatedAt: string
) {
  return appendDomainOutboxEvent(env.DB, {
    stream: MEMORY_EMBEDDING_STREAM,
    aggregateId: payload.memoryId,
    eventType: 'memory.embedding.delete',
    payload,
    idempotencyKey: `memory.embedding.delete:${payload.memoryId}:${updatedAt}`,
  });
}

export async function flushMemoryEmbeddingOutbox(
  env: Env,
  options: { limit?: number } = {}
) {
  const events = await listDomainOutboxEvents(env.DB, {
    stream: MEMORY_EMBEDDING_STREAM,
    status: 'pending',
    limit: options.limit ?? 25,
  });

  let processed = 0;

  for (const event of events) {
    try {
      if (event.eventType === 'memory.embedding.upsert') {
        await upsertMemoryEmbedding(env, event.payload as MemoryEmbeddingUpsertPayload);
      } else if (event.eventType === 'memory.embedding.delete') {
        await deleteMemoryEmbedding(env, event.payload as MemoryEmbeddingDeletePayload);
      }

      await markDomainOutboxProcessed(env.DB, event.id);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Memory embedding sync failed';
      await markDomainOutboxPending(env.DB, event.id, message);
    }
  }

  return {
    processed,
    scanned: events.length,
  };
}

export { MEMORY_EMBEDDING_STREAM };
