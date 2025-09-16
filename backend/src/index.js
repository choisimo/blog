import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config, publicRuntimeConfig } from './config.js';

import aiRouter from './routes/ai.js';
import commentsRouter from './routes/comments.js';
import ogRouter from './routes/og.js';
import adminRouter from './routes/admin.js';
import postsRouter from './routes/posts.js';
import imagesRouter from './routes/images.js';

const app = express();

// trust proxy (for correct IP in rate-limit, etc.)
app.set('trust proxy', config.trustProxy);

// security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const ok = config.allowedOrigins.some(o => o === origin);
    return callback(ok ? null : new Error('Not allowed by CORS'), ok);
  },
  credentials: true,
};
app.use(cors(corsOptions));

// logging
app.use(morgan('combined'));

// parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// basic rate limit (can be overridden per route if needed)
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// health & public config
app.get('/api/v1/healthz', (req, res) => {
  res.json({ ok: true, env: config.appEnv, uptime: process.uptime() });
});
app.get('/api/v1/public/config', (req, res) => {
  res.json({ ok: true, data: publicRuntimeConfig() });
});

// routes
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/comments', commentsRouter);
app.use('/api/v1/og', ogRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/posts', postsRouter);
app.use('/api/v1/images', imagesRouter);

// not found
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not Found' });
});

// error handler

app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ ok: false, error: err.message || 'Server Error' });
});

const port = config.port;
const host = config.host;
app.listen(port, host, () => {
  console.log(`[api] listening on http://${host}:${port}`);
});
