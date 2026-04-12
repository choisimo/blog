/**
 * AI Task Queue Service - Redis Streams based async processing
 *
 * Decouples AI requests from synchronous HTTP calls, enabling:
 *   - Async processing with automatic retries
 *   - Load distribution across multiple workers
 *   - Request deduplication and caching
 *   - Graceful degradation when AI services are overloaded
 *
 * Result notification uses Redis BLPOP (push-based) instead of polling,
 * eliminating O(timeout/interval) Redis GET calls per waiting request.
 *
 * Key layout:
 *   ai:tasks          — Redis Stream for pending tasks
 *   ai:dlq            — Redis Stream for dead-letter tasks
 *   ai:result:<id>    — STRING holding serialised result JSON (TTL=300s)
 *   ai:notify:<id>    — LIST used as BLPOP notification channel
 *   ai:tasks:stream   — MAXLEN-capped main stream (≤10 000 entries)
 */

import { getRedisClient, isRedisAvailable } from '../../lib/redis-client.js';
import { v4 as uuidv4 } from 'uuid';
import { TIMEOUTS } from '../../config/constants.js';
import { createLogger } from '../../lib/logger.js';
import { aiTaskDlqLength, DLQ_ALARM_THRESHOLD } from '../../lib/metrics.js';

const logger = createLogger('ai-task-queue');

const STREAM_NAME = 'ai:tasks';
const RESULT_PREFIX = 'ai:result:';
const NOTIFY_PREFIX = 'ai:notify:';
const DLQ_STREAM = 'ai:dlq';
const CONSUMER_GROUP = 'ai-workers';
const DEFAULT_TIMEOUT = TIMEOUTS.AI_TASK_WAIT;
const RESULT_TTL = 300;        // seconds — how long to keep result in Redis
const NOTIFY_TTL = 310;        // slightly longer than RESULT_TTL for safety
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 1000;
// Cap the main stream at ~10 000 entries to prevent unbounded memory growth.
// The '~' (approximate) trim is O(1) amortised and avoids blocking Redis.
const STREAM_MAXLEN = parseInt(process.env.AI_TASK_STREAM_MAXLEN || '10000', 10);

export class AITaskQueue {
  constructor() {
    this._initialized = false;
  }

  async _ensureConsumerGroup() {
    if (this._initialized) return;

    try {
      const client = await getRedisClient();
      await client.xGroupCreate(STREAM_NAME, CONSUMER_GROUP, '0', { MKSTREAM: true });
    } catch (err) {
      if (!err.message?.includes('BUSYGROUP')) {
        throw err;
      }
    }
    this._initialized = true;
  }

  async enqueue(task) {
    const client = await getRedisClient();
    await this._ensureConsumerGroup();

    const taskId = `task:${Date.now()}:${uuidv4().slice(0, 8)}`;

    await client.xAdd(
      STREAM_NAME,
      '*',
      {
        id: taskId,
        type: task.type,
        payload: JSON.stringify(task.payload),
        priority: String(task.priority || 'normal'),
        timestamp: String(Date.now()),
      },
      { MAXLEN: { strategy: '~', threshold: STREAM_MAXLEN } },
    );

    return taskId;
  }

  async waitForResult(taskId, timeout = DEFAULT_TIMEOUT) {
    const client = await getRedisClient();
    const resultKey = `${RESULT_PREFIX}${taskId}`;
    const notifyKey = `${NOTIFY_PREFIX}${taskId}`;

    const resultRaw = await client.get(resultKey);
    if (resultRaw) {
      await client.del(resultKey);
      return JSON.parse(resultRaw);
    }

    const timeoutSec = Math.max(1, Math.ceil(timeout / 1000));
    const entry = await client.blPop(notifyKey, timeoutSec);

    if (!entry) {
      throw new Error(`AI task timeout after ${timeout}ms: ${taskId}`);
    }

    const stored = await client.get(resultKey);
    if (!stored) {
      throw new Error(`AI task result missing after notification: ${taskId}`);
    }

    await client.del(resultKey);
    return JSON.parse(stored);
  }

  async submitResult(taskId, result) {
    const client = await getRedisClient();
    const resultKey = `${RESULT_PREFIX}${taskId}`;
    const notifyKey = `${NOTIFY_PREFIX}${taskId}`;

    await client.setEx(resultKey, RESULT_TTL, JSON.stringify(result));
    await client.lPush(notifyKey, '1');
    await client.expire(notifyKey, NOTIFY_TTL);
  }

  async consumeTasks(consumerName, handler, options = {}) {
    const client = await getRedisClient();
    await this._ensureConsumerGroup();

    const batchSize = options.batchSize || 1;
    const blockTime = options.blockTime || 5000;
    const pelClaimMinIdleMs = options.pelClaimMinIdleMs || 30_000;

    await this._recoverPEL(client, consumerName, batchSize, pelClaimMinIdleMs, handler);

    while (true) {
      try {
        const messages = await client.xReadGroup(
          CONSUMER_GROUP,
          consumerName,
          [{ key: STREAM_NAME, id: '>' }],
          { COUNT: batchSize, BLOCK: blockTime }
        );

        if (!messages?.length) continue;

        for (const stream of messages) {
          for (const message of stream.messages) {
            await this._processMessage(client, message, handler);
          }
        }
      } catch (err) {
        logger.error({}, 'Consumer error', { error: err.message });
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  async _recoverPEL(client, consumerName, batchSize, minIdleMs, handler) {
    let cursor = '-';
    let recovered = 0;

    while (true) {
      const pending = await client.xPending(STREAM_NAME, CONSUMER_GROUP, {
        start: cursor,
        end: '+',
        count: batchSize,
      }).catch(() => []);

      if (!pending?.length) break;

      const ids = pending.map(p => p.id);
      const claimed = await client.xClaim(
        STREAM_NAME,
        CONSUMER_GROUP,
        consumerName,
        minIdleMs,
        ids,
      ).catch(() => []);

      for (const message of claimed) {
        await this._processMessage(client, message, handler);
        recovered++;
      }

      const lastId = pending[pending.length - 1].id;
      if (pending.length < batchSize) break;
      cursor = lastId;
    }

    if (recovered > 0) {
      logger.info({}, `Recovered ${recovered} orphaned PEL message(s) on startup`);
    }
  }

  async _processMessage(client, message, handler) {
    const retryCount = parseInt(message.message.retryCount || '0', 10);
    const task = {
      id: message.message.id,
      type: message.message.type,
      payload: JSON.parse(message.message.payload),
      priority: message.message.priority,
      messageId: message.id,
      retryCount,
    };

    try {
      const result = await handler(task);
      await this.submitResult(task.id, { ok: true, data: result });
      await client.xAck(STREAM_NAME, CONSUMER_GROUP, message.id);
    } catch (err) {
      if (retryCount < MAX_RETRIES) {
        await this._retryTask(task, message.id, err.message);
      } else {
        await this._moveToDLQ(task, err.message);
        await this.submitResult(task.id, { ok: false, error: err.message, dlq: true });
      }
      await client.xAck(STREAM_NAME, CONSUMER_GROUP, message.id);
    }
  }

  async _retryTask(task, originalMessageId, errorMessage) {
    const client = await getRedisClient();
    const delay = RETRY_BACKOFF_MS * Math.pow(2, task.retryCount);
    
    logger.info({}, `Retrying task ${task.id} (attempt ${task.retryCount + 1}/${MAX_RETRIES}) after ${delay}ms`);
    
    await new Promise(r => setTimeout(r, delay));
    
    await client.xAdd(
      STREAM_NAME,
      '*',
      {
        id: task.id,
        type: task.type,
        payload: JSON.stringify(task.payload),
        priority: task.priority,
        timestamp: String(Date.now()),
        retryCount: String(task.retryCount + 1),
        lastError: errorMessage,
      },
      { MAXLEN: { strategy: '~', threshold: STREAM_MAXLEN } },
    );
  }

  async _moveToDLQ(task, errorMessage) {
    const client = await getRedisClient();
    
    logger.error({}, `Moving task ${task.id} to DLQ after ${MAX_RETRIES} retries`, { error: errorMessage });
    
    await client.xAdd(DLQ_STREAM, '*', {
      id: task.id,
      type: task.type,
      payload: JSON.stringify(task.payload),
      priority: task.priority,
      timestamp: String(Date.now()),
      failedAt: new Date().toISOString(),
      retryCount: String(task.retryCount),
      lastError: errorMessage,
    });

    const dlqLength = await client.xLen(DLQ_STREAM).catch(() => 0);
    aiTaskDlqLength.set(dlqLength);

    if (dlqLength >= DLQ_ALARM_THRESHOLD) {
      logger.warn({ dlqLength, threshold: DLQ_ALARM_THRESHOLD }, 'DLQ threshold exceeded — manual review required');
    }
  }

  async getQueueStats() {
    const client = await getRedisClient();

    const streamLength = await client.xLen(STREAM_NAME);
    const dlqLength = await client.xLen(DLQ_STREAM).catch(() => 0);
    const groups = await client.xInfoGroups(STREAM_NAME).catch(() => []);

    // Report backlog pressure from consumer-group pending entries, not the raw
    // stream length. The stream retains acknowledged history, so XLEN grows over
    // time and is not a proxy for queued work.
    const pendingLength = groups.reduce(
      (sum, group) => sum + Number(group.pending || 0),
      0
    );
    
    return {
      queueLength: pendingLength,
      streamLength,
      dlqLength,
      consumerGroups: groups.map(g => ({
        name: g.name,
        consumers: g.consumers,
        pending: g.pending,
      })),
    };
  }

  async getDLQTasks(count = 10) {
    const client = await getRedisClient();
    const messages = await client.xRange(DLQ_STREAM, '-', '+', { COUNT: count });
    
    return messages.map(m => ({
      messageId: m.id,
      id: m.message.id,
      type: m.message.type,
      payload: JSON.parse(m.message.payload),
      failedAt: m.message.failedAt,
      retryCount: parseInt(m.message.retryCount, 10),
      lastError: m.message.lastError,
    }));
  }

  async reprocessDLQTask(messageId) {
    const client = await getRedisClient();
    
    const messages = await client.xRange(DLQ_STREAM, messageId, messageId, { COUNT: 1 });
    if (!messages.length) {
      throw new Error(`DLQ message not found: ${messageId}`);
    }
    
    const m = messages[0];
    
    await client.xAdd(
      STREAM_NAME,
      '*',
      {
        id: m.message.id,
        type: m.message.type,
        payload: m.message.payload,
        priority: m.message.priority || 'normal',
        timestamp: String(Date.now()),
        retryCount: '0',
        reprocessedFrom: messageId,
      },
      { MAXLEN: { strategy: '~', threshold: STREAM_MAXLEN } },
    );
    
    await client.xDel(DLQ_STREAM, messageId);
    
    return { requeued: true, taskId: m.message.id };
  }

  async purgeDLQ() {
    const client = await getRedisClient();
    const length = await client.xLen(DLQ_STREAM);
    await client.del(DLQ_STREAM);
    return { purged: length };
  }
}

let _queue = null;

export function getAITaskQueue() {
  if (!_queue) {
    _queue = new AITaskQueue();
  }
  return _queue;
}

export async function enqueueAITask(task) {
  if (!await isRedisAvailable()) {
    return null;
  }
  return getAITaskQueue().enqueue(task);
}

export async function waitForAIResult(taskId, timeout) {
  return getAITaskQueue().waitForResult(taskId, timeout);
}
