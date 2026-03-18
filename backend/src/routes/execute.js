import { Router } from 'express';
import { createLogger } from '../lib/logger.js';
import { validateBody } from '../middleware/validation.js';
import { executeBodySchema } from '../middleware/schemas/execute.schema.js';

const router = Router();
const logger = createLogger('execute');

const PISTON_BASE_URL = process.env.PISTON_URL || 'http://piston:2000';

router.get('/runtimes', async (req, res) => {
  try {
    const response = await fetch(`${PISTON_BASE_URL}/api/v2/runtimes`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: 'Piston runtimes unavailable' });
    }
    const data = await response.json();
    return res.json({ ok: true, data });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch piston runtimes');
    return res.status(503).json({ ok: false, error: 'Code execution service unavailable' });
  }
});

router.post('/', validateBody(executeBodySchema), async (req, res) => {
  const { language, version, files, stdin, args, compile_timeout, run_timeout } = req.body;

  const payload = {
    language,
    version: version || '*',
    files,
    ...(stdin !== undefined && { stdin }),
    ...(args !== undefined && { args }),
    ...(compile_timeout !== undefined && { compile_timeout }),
    ...(run_timeout !== undefined && { run_timeout }),
  };

  try {
    const response = await fetch(`${PISTON_BASE_URL}/api/v2/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.warn({ status: response.status, language }, 'Piston execution error');
      return res.status(response.status).json({ ok: false, error: data?.message || 'Execution failed' });
    }

    logger.info({ language, exitCode: data?.run?.code }, 'Code executed');
    return res.json({ ok: true, data });
  } catch (err) {
    logger.error({ err, language }, 'Piston execute request failed');
    return res.status(503).json({ ok: false, error: 'Code execution service unavailable' });
  }
});

export default router;
