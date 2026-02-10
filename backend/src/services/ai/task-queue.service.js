/**
 * AI Task Queue Service - Redis Streams based async processing
 * 
 * Decouples AI requests from synchronous HTTP calls, enabling:
 *   - Async processing with automatic retries
 *   - Load distribution across multiple workers
 *   - Request deduplication and caching
 *   - Graceful degradation when AI services are overloaded
 */

import { getRedisClient, isRedisAvailable } from '../../lib/redis-client.js';
import { v4 as uuidv4 } from 'uuid';
import { TIMEOUTS } from '../../config/constants.js';

const STREAM_NAME = 'ai:tasks';
const RESULT_PREFIX = 'ai:result:';
const DLQ_STREAM = 'ai:dlq';
const CONSUMER_GROUP = 'ai-workers';
const DEFAULT_TIMEOUT = TIMEOUTS.AI_TASK_WAIT;
const RESULT_TTL = 300;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 1000;

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
    
    await client.xAdd(STREAM_NAME, '*', {
      id: taskId,
      type: task.type,
      payload: JSON.stringify(task.payload),
      priority: String(task.priority || 'normal'),
      timestamp: String(Date.now()),
    });

    return taskId;
  }

  async waitForResult(taskId, timeout = DEFAULT_TIMEOUT) {
    const client = await getRedisClient();
    const resultKey = `${RESULT_PREFIX}${taskId}`;
    
    const start = Date.now();
    const pollInterval = 100;

    while (Date.now() - start < timeout) {
      const result = await client.get(resultKey);
      if (result) {
        await client.del(resultKey);
        return JSON.parse(result);
      }
      await new Promise(r => setTimeout(r, pollInterval));
    }

    throw new Error(`AI task timeout after ${timeout}ms: ${taskId}`);
  }

  async submitResult(taskId, result) {
    const client = await getRedisClient();
    const resultKey = `${RESULT_PREFIX}${taskId}`;
    
    await client.setEx(resultKey, RESULT_TTL, JSON.stringify(result));
  }

  async consumeTasks(consumerName, handler, options = {}) {
    const client = await getRedisClient();
    await this._ensureConsumerGroup();

    const batchSize = options.batchSize || 1;
    const blockTime = options.blockTime || 5000;

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
        }
      } catch (err) {
        console.error('[AITaskQueue] Consumer error:', err.message);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  async _retryTask(task, originalMessageId, errorMessage) {
    const client = await getRedisClient();
    const delay = RETRY_BACKOFF_MS * Math.pow(2, task.retryCount);
    
    console.log(`[AITaskQueue] Retrying task ${task.id} (attempt ${task.retryCount + 1}/${MAX_RETRIES}) after ${delay}ms`);
    
    await new Promise(r => setTimeout(r, delay));
    
    await client.xAdd(STREAM_NAME, '*', {
      id: task.id,
      type: task.type,
      payload: JSON.stringify(task.payload),
      priority: task.priority,
      timestamp: String(Date.now()),
      retryCount: String(task.retryCount + 1),
      lastError: errorMessage,
    });
  }

  async _moveToDLQ(task, errorMessage) {
    const client = await getRedisClient();
    
    console.error(`[AITaskQueue] Moving task ${task.id} to DLQ after ${MAX_RETRIES} retries: ${errorMessage}`);
    
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
  }

  async getQueueStats() {
    const client = await getRedisClient();
    
    const length = await client.xLen(STREAM_NAME);
    const dlqLength = await client.xLen(DLQ_STREAM).catch(() => 0);
    const groups = await client.xInfoGroups(STREAM_NAME).catch(() => []);
    
    return {
      queueLength: length,
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
    
    await client.xAdd(STREAM_NAME, '*', {
      id: m.message.id,
      type: m.message.type,
      payload: m.message.payload,
      priority: m.message.priority || 'normal',
      timestamp: String(Date.now()),
      retryCount: '0',
      reprocessedFrom: messageId,
    });
    
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
