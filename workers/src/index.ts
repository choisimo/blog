import { Hono } from 'hono';
import type { Env } from './types';
import { corsMiddleware } from './middleware/cors';
import { loggerMiddleware } from './middleware/logger';
import { errorHandler } from './middleware/error';
import { success } from './lib/response';

// Import routes
import auth from './routes/auth';
import posts from './routes/posts';
import comments from './routes/comments';
import ai from './routes/ai';
import chat from './routes/chat';
import images from './routes/images';
import og from './routes/og';

const app = new Hono<{ Bindings: Env }>();

// Global middlewares
app.use('*', corsMiddleware);
app.use('*', loggerMiddleware);

// Health check
app.get('/healthz', (c) => {
  return success(c, {
    status: 'ok',
    env: c.env.ENV,
    timestamp: new Date().toISOString(),
  });
});

// Public config
app.get('/public/config', (c) => {
  return success(c, {
    env: c.env.ENV,
    features: {
      aiInline: true,
      comments: true,
    },
  });
});

// Mount API routes under /api/v1
const api = new Hono<{ Bindings: Env }>();
api.route('/auth', auth);
api.route('/posts', posts);
api.route('/comments', comments);
api.route('/ai', ai);
api.route('/chat', chat);
api.route('/images', images);
api.route('/og', og);

app.route('/api/v1', api);

// 404 handler
app.notFound((c) => {
  return c.json({ ok: false, error: { message: 'Not Found' } }, 404);
});

// Error handler
app.onError(errorHandler);

export default app;
