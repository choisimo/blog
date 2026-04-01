import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const redisConnectionStatus = new client.Gauge({
  name: 'redis_connection_up',
  help: '1 if Redis connection is up, 0 otherwise',
  registers: [register],
});

export const aiTaskQueueLength = new client.Gauge({
  name: 'ai_task_queue_length',
  help: 'Number of pending tasks in the AI task queue',
  registers: [register],
});

export const aiTaskDlqLength = new client.Gauge({
  name: 'ai_task_dlq_length',
  help: 'Number of tasks in the AI dead-letter queue',
  registers: [register],
});

export const DLQ_ALARM_THRESHOLD = parseInt(process.env.AI_DLQ_ALARM_THRESHOLD || '10', 10);

export const aiRequestsTotal = new client.Counter({
  name: 'ai_requests_total',
  help: 'Total AI requests processed',
  labelNames: ['type', 'status'],
  registers: [register],
});

export const aiRequestDuration = new client.Histogram({
  name: 'ai_request_duration_seconds',
  help: 'Duration of AI requests in seconds',
  labelNames: ['type'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [register],
});

export { register };
