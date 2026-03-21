#!/usr/bin/env node
import { getAITaskQueue } from "../lib/ai-task-queue.js";
import { getRedisClient, closeRedis } from "../lib/redis-client.js";
import { createLogger } from "../lib/logger.js";
import { AI_MODELS } from "../config/constants.js";

const logger = createLogger("ai-worker");

const WORKER_NAME = process.env.AI_WORKER_NAME || `worker-${process.pid}`;
const BATCH_SIZE = parseInt(process.env.AI_WORKER_BATCH_SIZE, 10) || 1;
const BLOCK_TIME = parseInt(process.env.AI_WORKER_BLOCK_TIME, 10) || 5000;

let openaiClient = null;

async function getClient() {
  if (openaiClient) return openaiClient;
  const { getOpenAIClient } = await import("../lib/openai-compat-client.js");
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
    provider: response.provider || "openai-compat",
    usage: response.usage,
    sessionId: response.sessionId,
  };
}

async function handleVisionTask(task) {
  const { imageData, prompt, options = {} } = task.payload;
  const client = await getClient();

  const result = await client.vision(imageData, prompt, {
    mimeType: options.mimeType || "image/jpeg",
    model: options.model || AI_MODELS.VISION,
    timeout: options.timeout,
  });

  return result;
}

async function taskHandler(task) {
  logger.info({ taskId: task.id, taskType: task.type }, "Processing task");
  const startTime = Date.now();

  let result;

  switch (task.type) {
    case "generate":
      result = await handleGenerateTask(task);
      break;
    case "chat":
      result = await handleChatTask(task);
      break;
    case "vision":
      result = await handleVisionTask(task);
      break;
    default:
      throw new Error(`Unknown task type: ${task.type}`);
  }

  const duration = Date.now() - startTime;
  logger.info({ taskId: task.id, durationMs: duration }, "Completed task");

  return result;
}

async function startWorker() {
  logger.info({}, "Starting AI worker");
  logger.info(
    { batchSize: BATCH_SIZE, blockTimeMs: BLOCK_TIME },
    "Worker config",
  );

  try {
    await getRedisClient();
    logger.info({}, "Redis connected");
  } catch (err) {
    logger.error({}, "Failed to connect to Redis", { error: err.message });
    process.exit(1);
  }

  const queue = getAITaskQueue();

  logger.info({}, "Starting task consumer loop");

  await queue.consumeTasks(WORKER_NAME, taskHandler, {
    batchSize: BATCH_SIZE,
    blockTime: BLOCK_TIME,
  });
}

async function gracefulShutdown(signal) {
  logger.info({ signal }, "Received signal, shutting down");

  try {
    await closeRedis();
  } catch (err) {
    logger.error({}, "Error during shutdown", { error: err.message });
  }

  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

startWorker().catch((err) => {
  logger.error({}, "Fatal error", { error: err.message });
  process.exit(1);
});
