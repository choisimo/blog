#!/usr/bin/env node
import { getAITaskQueue } from '../lib/ai-task-queue.js';
import { getRedisClient, closeRedis } from '../lib/redis-client.js';

const WORKER_NAME = process.env.AI_WORKER_NAME || `worker-${process.pid}`;
const BATCH_SIZE = parseInt(process.env.AI_WORKER_BATCH_SIZE, 10) || 1;
const BLOCK_TIME = parseInt(process.env.AI_WORKER_BLOCK_TIME, 10) || 5000;

let openaiClient = null;

async function getClient() {
  if (openaiClient) return openaiClient;
  const { getOpenAIClient } = await import('../lib/openai-compat-client.js');
  openaiClient = getOpenAIClient();
  return openaiClient;
}

async function handleGenerateTask(task) {
  const { prompt, options = {} } = task.payload;
  const client = await getClient();
  
  const result = await client.generate(prompt, {
    temperature: options.temperature,
    model: options.model,
    systemPrompt: options.systemPrompt,
    timeout: options.timeout,
  });
  
  return result;
}

async function handleChatTask(task) {
  const { messages, options = {} } = task.payload;
  const client = await getClient();
  
  const response = await client.chat(messages, {
    temperature: options.temperature,
    model: options.model,
    timeout: options.timeout,
  });
  
  return {
    content: response.content,
    model: response.model,
    provider: response.provider || 'openai-compat',
    usage: response.usage,
    sessionId: response.sessionId,
  };
}

async function handleVisionTask(task) {
  const { imageData, prompt, options = {} } = task.payload;
  const client = await getClient();
  
  const result = await client.vision(imageData, prompt, {
    mimeType: options.mimeType || 'image/jpeg',
    model: options.model || 'gpt-4o',
    timeout: options.timeout,
  });
  
  return result;
}

async function taskHandler(task) {
  console.log(`[${WORKER_NAME}] Processing task: ${task.id} (${task.type})`);
  const startTime = Date.now();
  
  let result;
  
  switch (task.type) {
    case 'generate':
      result = await handleGenerateTask(task);
      break;
    case 'chat':
      result = await handleChatTask(task);
      break;
    case 'vision':
      result = await handleVisionTask(task);
      break;
    default:
      throw new Error(`Unknown task type: ${task.type}`);
  }
  
  const duration = Date.now() - startTime;
  console.log(`[${WORKER_NAME}] Completed task: ${task.id} in ${duration}ms`);
  
  return result;
}

async function startWorker() {
  console.log(`[${WORKER_NAME}] Starting AI worker...`);
  console.log(`[${WORKER_NAME}] Config: batchSize=${BATCH_SIZE}, blockTime=${BLOCK_TIME}ms`);
  
  try {
    await getRedisClient();
    console.log(`[${WORKER_NAME}] Redis connected`);
  } catch (err) {
    console.error(`[${WORKER_NAME}] Failed to connect to Redis:`, err.message);
    process.exit(1);
  }
  
  const queue = getAITaskQueue();
  
  console.log(`[${WORKER_NAME}] Starting task consumer loop...`);
  
  await queue.consumeTasks(WORKER_NAME, taskHandler, {
    batchSize: BATCH_SIZE,
    blockTime: BLOCK_TIME,
  });
}

async function gracefulShutdown(signal) {
  console.log(`[${WORKER_NAME}] Received ${signal}, shutting down...`);
  
  try {
    await closeRedis();
  } catch (err) {
    console.error(`[${WORKER_NAME}] Error during shutdown:`, err.message);
  }
  
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startWorker().catch(err => {
  console.error(`[${WORKER_NAME}] Fatal error:`, err);
  process.exit(1);
});
