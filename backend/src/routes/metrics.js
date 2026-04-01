import { Router } from 'express';
import { register, redisConnectionStatus, aiTaskQueueLength, aiTaskDlqLength } from '../lib/metrics.js';
import { isRedisAvailable } from '../lib/redis-client.js';
import { getAITaskQueue } from '../services/ai/task-queue.service.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const redisUp = await isRedisAvailable();
    redisConnectionStatus.set(redisUp ? 1 : 0);

    if (redisUp) {
      try {
        const stats = await getAITaskQueue().getQueueStats();
        aiTaskQueueLength.set(stats.queueLength ?? 0);
        aiTaskDlqLength.set(stats.dlqLength ?? 0);
      } catch {
        // non-critical — metrics still served even if queue stats fail
      }
    }

    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.end(metrics);
  } catch (err) {
    res.status(500).end(err.message);
  }
});

export default router;
