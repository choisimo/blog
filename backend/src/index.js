import { randomUUID } from 'crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config, publicRuntimeConfig, loadAndApplyConsulConfig } from './config.js';
import { requireBackendKey } from './middleware/backendAuth.js';
import { httpCache } from './middleware/httpCache.js';
import { httpRequestDuration, httpRequestsTotal } from './lib/metrics.js';
import { logger, enablePgLogs } from './lib/logger.js';
import { runMigrations, isPgConfigured } from './repositories/analytics.repository.js';
import { closeRedis } from './lib/redis-client.js';

import aiRouter from './routes/ai.js';
import commentsRouter from './routes/comments.js';
import analyticsRouter from './routes/analytics.js';
import chatRouter, { initChatWebSocket } from './routes/chat.js';
import translateRouter from './routes/translate.js';
import userContentRouter from './routes/userContent.js';
import ogRouter from './routes/og.js';
import adminRouter from './routes/admin.js';
import postsRouter from './routes/posts.js';
import imagesRouter from './routes/images.js';
import authRouter from './routes/auth.js';
import ragRouter from './routes/rag.js';
import memoriesRouter from './routes/memories.js';
import memosRouter from './routes/memos.js';
import userRouter from './routes/user.js';
import searchRouter from './routes/search.js';
import configRouter from './routes/config.js';
import workersRouter from './routes/workers.js';
import agentRouter from './routes/agent.js';
import notificationsRouter from './routes/notifications.js';
import debateRouter from './routes/debate.js';
import metricsRouter from './routes/metrics.js';
import adminLogsRouter from './routes/adminLogs.js';
import executeRouter from './routes/execute.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

async function startServer() {
  await loadAndApplyConsulConfig();

  if (isPgConfigured()) {
    try {
      await runMigrations();
      enablePgLogs();
      logger.info({}, 'PostgreSQL migrations applied');
    } catch (err) {
      logger.warn({}, 'PostgreSQL migration failed, continuing without PG', { error: err.message });
    }
  }
  
  const app = express();

app.set('trust proxy', config.trustProxy);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const ok = config.allowedOrigins.some(o => o === origin);
    return callback(ok ? null : new Error('Not allowed by CORS'), ok);
  },
  credentials: true,
};
app.use(cors(corsOptions));

app.use(morgan('combined'));

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path || req.path || 'unknown';
    const labels = { method: req.method, route, status_code: res.statusCode };
    end(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
});

app.get('/api/v1/healthz', (req, res) => {
  res.json({ ok: true, env: config.appEnv, uptime: process.uptime() });
});
app.get('/api/v1/public/config', httpCache({ ttl: 300, prefix: 'config' }), (req, res) => {
  res.json({ ok: true, data: publicRuntimeConfig() });
});
app.use('/metrics', metricsRouter);

app.use('/api/v1/notifications', notificationsRouter);
app.use(requireBackendKey);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/comments', commentsRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/translate', translateRouter);
app.use('/api/v1/memos', memosRouter);
app.use('/api/v1/user-content', userContentRouter);
app.use('/api/v1/og', ogRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/posts', postsRouter);
app.use('/api/v1/images', imagesRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/rag', ragRouter);
app.use('/api/v1/memories', memoriesRouter);
app.use('/api/v1/user', userRouter);
app.use('/api/v1/search', searchRouter);
app.use('/api/v1/admin/config', configRouter);
app.use('/api/v1/admin/workers', workersRouter);
app.use('/api/v1/admin', adminLogsRouter);
app.use('/api/v1/agent', agentRouter);

app.use('/api/v1/debate', debateRouter);
app.use('/api/v1/execute', executeRouter);

app.use(notFoundHandler);

app.use(errorHandler);

const port = config.port;
const host = config.host;
const server = app.listen(port, host, () => {
  logger.info({ port, host }, `listening on http://${host}:${port}`);
  logger.info({ features: { ai: config.features.aiEnabled, rag: config.features.ragEnabled, comments: config.features.commentsEnabled } }, 'features');
});
initChatWebSocket(server);

let shuttingDown = false;
function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Received shutdown signal, closing server...');

  server.close(async () => {
    logger.info({}, 'HTTP server closed');
    try {
      await closeRedis();
      logger.info({}, 'Redis connections closed');
    } catch (err) {
      logger.error({ err }, 'Failed to close Redis connections');
    }
    process.exit(0);
  });

  setTimeout(() => {
    logger.error({}, 'Shutdown timed out after 10s, forcing exit');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception — shutting down');
  gracefulShutdown('uncaughtException');
});
}

startServer().catch(err => {
  logger.error({}, 'Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});
