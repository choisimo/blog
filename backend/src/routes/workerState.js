import { Router } from 'express';
import { requireBackendKey } from '../middleware/backendAuth.js';
import { workerStateStore, WorkerStateError } from '../services/worker-state-store.service.js';

export function createWorkerStateRouter({ store = workerStateStore } = {}) {
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, requireBackendKey, (req, res, next) => {
    if (req.gatewaySignatureVerified !== true) {
      return res.status(403).json({ ok: false, error: { code: 'STATE_SIGNATURE_REQUIRED' } });
    }
    next();
  });

  function respond(res, fn) {
    try {
      return res.json(fn());
    } catch (error) {
      const known = error instanceof WorkerStateError;
      return res.status(known ? error.status : 500).json({
        ok: false, error: { code: known ? error.code : 'STATE_STORE_FAILED',
          message: known ? error.message : 'State database request failed' },
      });
    }
  }
  router.get('/health', (_req, res) => respond(res, () => ({ ok: true, ...store.health() })));
  router.post('/query', (req, res) => respond(res, () => store.execute(req.body)));
  return router;
}

export default createWorkerStateRouter();
