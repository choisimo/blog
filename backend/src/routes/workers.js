import { Router } from 'express';
import { config } from '../config.js';
import requireAdmin from '../middleware/adminAuth.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WORKER_DEPLOYMENTS } from '../../../shared/src/contracts/workers.js';

const router = Router();

const WORKERS_ROOT = config.paths?.workersDir || path.join(config.content.repoRoot, 'workers');
const workerMutationsEnabled = process.env.ADMIN_WORKER_MUTATIONS === 'true';
const WORKER_MUTATION_ENVS = new Set(['development', 'production']);
const WORKER_VAR_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;


const WORKERS_CONFIG = WORKER_DEPLOYMENTS.map((worker) => ({
  ...worker,
}));

const KNOWN_SECRETS = [
  { key: 'JWT_SECRET', description: 'JWT 서명 키', workers: ['api-gateway', 'terminal-gateway'] },
  { key: 'GEMINI_API_KEY', description: 'Google Gemini API 키', workers: ['api-gateway'] },
  { key: 'ADMIN_USERNAME', description: '관리자 사용자명', workers: ['api-gateway'] },
  { key: 'ADMIN_PASSWORD', description: '관리자 비밀번호', workers: ['api-gateway'] },
  { key: 'ADMIN_EMAIL', description: '관리자 이메일 (OTP)', workers: ['api-gateway'] },
  { key: 'OPENROUTER_API_KEY', description: 'OpenRouter API 키', workers: ['api-gateway'] },
  { key: 'BACKEND_ORIGIN', description: '백엔드 서버 URL', workers: ['api-gateway'] },
  { key: 'BACKEND_KEY', description: 'Workers → Backend 인증 키 (X-Backend-Key)', workers: ['api-gateway'] },
  { key: 'RESEND_API_KEY', description: 'Resend.com API 키', workers: ['api-gateway'] },
  { key: 'INTERNAL_KEY', description: 'API GW → R2 GW 인증 키 (X-Internal-Key)', workers: ['api-gateway', 'r2-gateway'] },
  { key: 'TERMINAL_SESSION_SECRET', description: 'Terminal connect token signing key', workers: ['terminal-gateway'] },
];

function requireWorkerMutationCapability(req, res, next) {
  if (!workerMutationsEnabled) {
    return res.status(403).json({
      ok: false,
      error: {
        code: 'WORKER_MUTATIONS_DISABLED',
        message: 'Worker mutations are disabled in this environment. Use CI/GitOps.',
      },
    });
  }
  next();
}

function workerMutationBadRequest(res, code, message) {
  return res.status(400).json({
    ok: false,
    error: { code, message },
  });
}

function normalizeWorkerMutationEnv(rawEnv, fallback) {
  const env = String(rawEnv || fallback).trim();
  return WORKER_MUTATION_ENVS.has(env) ? env : null;
}

function isValidWorkerVarKey(key) {
  return typeof key === 'string' && WORKER_VAR_KEY_PATTERN.test(key);
}

function toTomlBasicStringValue(value) {
  if (!['string', 'number', 'boolean'].includes(typeof value)) {
    return null;
  }
  const stringValue = String(value);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(stringValue)) {
    return null;
  }
  return stringValue
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function normalizeWorkerVarUpdates(vars) {
  if (!vars || typeof vars !== 'object' || Array.isArray(vars)) {
    return { error: 'vars object required' };
  }

  const updates = [];
  for (const [key, rawValue] of Object.entries(vars)) {
    if (!isValidWorkerVarKey(key)) {
      return { error: `Invalid variable key: ${key}` };
    }
    const value = toTomlBasicStringValue(rawValue);
    if (value === null) {
      return { error: `Invalid value for ${key}; expected string, number, or boolean` };
    }
    updates.push({ key, value });
  }

  if (updates.length === 0) {
    return { error: 'vars must include at least one variable' };
  }

  return { updates };
}

function replaceWorkerVar(content, env, key, value) {
  const targetSection = env === 'production' ? 'env.production.vars' : 'vars';
  const lines = content.split(/\r?\n/);
  let inTargetSection = false;
  let updated = false;

  const nextLines = lines.map((line) => {
    const header = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (header) {
      inTargetSection = header[1] === targetSection;
      return line;
    }

    if (!inTargetSection) return line;

    const assignment = line.match(
      /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"(?:[^"\\]|\\.)*"(.*)$/
    );
    if (!assignment || assignment[2] !== key) return line;

    updated = true;
    return `${assignment[1]}${key} = "${value}"${assignment[3]}`;
  });

  return { content: nextLines.join('\n'), updated };
}

router.get('/list', requireAdmin, async (req, res) => {
  try {
    const workers = await Promise.all(
      WORKERS_CONFIG.map(async (w) => {
        const wranglerPath = path.join(WORKERS_ROOT, w.wranglerPath);
        let exists = false;
        let config = null;

        try {
          const content = await fs.readFile(wranglerPath, 'utf8');
          exists = true;
          config = parseWranglerToml(content);
        } catch {
          exists = false;
        }

        return {
          ...w,
          exists,
          config,
          mutationsEnabled: workerMutationsEnabled,
        };
      })
    );

    res.json({ ok: true, data: { workers } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/secrets', requireAdmin, (req, res) => {
  res.json({ ok: true, data: { secrets: KNOWN_SECRETS } });
});

router.get('/:workerId/config', requireAdmin, async (req, res) => {
  const { workerId } = req.params;
  const worker = WORKERS_CONFIG.find((w) => w.id === workerId);

  if (!worker) {
    return res.status(404).json({ ok: false, error: 'Worker not found' });
  }

  try {
    const wranglerPath = path.join(WORKERS_ROOT, worker.wranglerPath);
    const content = await fs.readFile(wranglerPath, 'utf8');
    const parsed = parseWranglerToml(content);

    res.json({
      ok: true,
      data: {
        worker,
        raw: content,
        parsed,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/:workerId/vars', requireAdmin, requireWorkerMutationCapability, async (req, res) => {
  const { workerId } = req.params;
  const env = normalizeWorkerMutationEnv(req.body?.env, 'development');
  if (!env) {
    return workerMutationBadRequest(
      res,
      'INVALID_WORKER_ENV',
      'env must be development or production'
    );
  }
  const normalizedVars = normalizeWorkerVarUpdates(req.body?.vars);
  if (normalizedVars.error) {
    return workerMutationBadRequest(res, 'INVALID_WORKER_VARS', normalizedVars.error);
  }
  const worker = WORKERS_CONFIG.find((w) => w.id === workerId);

  if (!worker) {
    return res.status(404).json({ ok: false, error: 'Worker not found' });
  }

  try {
    const wranglerPath = path.join(WORKERS_ROOT, worker.wranglerPath);
    let content = await fs.readFile(wranglerPath, 'utf8');
    const updated = [];

    for (const { key, value } of normalizedVars.updates) {
      const result = replaceWorkerVar(content, env, key, value);
      content = result.content;
      if (result.updated) updated.push(key);
    }

    if (updated.length === 0) {
      return workerMutationBadRequest(
        res,
        'WORKER_VARS_NOT_FOUND',
        `No matching ${env} worker variables found`
      );
    }

    await fs.writeFile(wranglerPath, content, 'utf8');

    res.json({ ok: true, data: { message: 'Variables updated', path: wranglerPath, updated } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/:workerId/secret', requireAdmin, requireWorkerMutationCapability, async (req, res) => {
  const { workerId } = req.params;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { key, value } = body;
  const env = normalizeWorkerMutationEnv(body.env, 'production');
  if (!env) {
    return workerMutationBadRequest(
      res,
      'INVALID_WORKER_ENV',
      'env must be development or production'
    );
  }
  const worker = WORKERS_CONFIG.find((w) => w.id === workerId);

  if (!worker) {
    return res.status(404).json({ ok: false, error: 'Worker not found' });
  }

  if (!isValidWorkerVarKey(key) || typeof value !== 'string' || value.length === 0) {
    return workerMutationBadRequest(
      res,
      'INVALID_WORKER_SECRET',
      'key must be a valid variable name and value must be a non-empty string'
    );
  }

  try {
    const cwd = worker.path ? path.join(WORKERS_ROOT, worker.path) : WORKERS_ROOT;
    const args = ['secret', 'put', key];
    if (env === 'production') {
      args.push('--env', 'production');
    }

    const result = await runWranglerCommand(args, cwd, value);

    res.json({ ok: true, data: { message: `Secret ${key} set`, output: result } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/:workerId/deploy', requireAdmin, requireWorkerMutationCapability, async (req, res) => {
  const { workerId } = req.params;
  const env = normalizeWorkerMutationEnv(req.body?.env, 'production');
  if (!env) {
    return workerMutationBadRequest(
      res,
      'INVALID_WORKER_ENV',
      'env must be development or production'
    );
  }
  const dryRun = req.body?.dryRun === true;
  const worker = WORKERS_CONFIG.find((w) => w.id === workerId);

  if (!worker) {
    return res.status(404).json({ ok: false, error: 'Worker not found' });
  }

  try {
    const cwd = worker.path ? path.join(WORKERS_ROOT, worker.path) : WORKERS_ROOT;
    const args = ['deploy'];
    if (env === 'production' && worker.hasProduction) {
      args.push('--env', 'production');
    }
    if (dryRun) {
      args.push('--dry-run');
    }

    const result = await runWranglerCommand(args, cwd);

    res.json({
      ok: true,
      data: {
        message: dryRun ? 'Dry run completed' : 'Deployment completed',
        output: result,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/:workerId/tail', requireAdmin, async (req, res) => {
  const { workerId } = req.params;
  const worker = WORKERS_CONFIG.find((w) => w.id === workerId);

  if (!worker) {
    return res.status(404).json({ ok: false, error: 'Worker not found' });
  }

  res.json({
    ok: true,
    data: {
      message: 'Use wrangler tail command for real-time logs',
      command: `cd workers${worker.path ? '/' + worker.path : ''} && npx wrangler tail`,
    },
  });
});

router.get('/d1/databases', requireAdmin, async (req, res) => {
  try {
    const result = await runWranglerCommand(['d1', 'list', '--json'], WORKERS_ROOT);
    const databases = JSON.parse(result);
    res.json({ ok: true, data: { databases } });
  } catch (err) {
    res.json({ ok: true, data: { databases: [], error: err.message } });
  }
});

router.get('/kv/namespaces', requireAdmin, async (req, res) => {
  try {
    const result = await runWranglerCommand(['kv:namespace', 'list', '--json'], WORKERS_ROOT);
    const namespaces = JSON.parse(result);
    res.json({ ok: true, data: { namespaces } });
  } catch (err) {
    res.json({ ok: true, data: { namespaces: [], error: err.message } });
  }
});

router.get('/r2/buckets', requireAdmin, async (req, res) => {
  try {
    const result = await runWranglerCommand(['r2', 'bucket', 'list', '--json'], WORKERS_ROOT);
    const buckets = JSON.parse(result);
    res.json({ ok: true, data: { buckets } });
  } catch (err) {
    res.json({ ok: true, data: { buckets: [], error: err.message } });
  }
});

function parseWranglerToml(content) {
  const result = {
    name: '',
    main: '',
    compatibility_date: '',
    account_id: '',
    vars: {},
    production: {
      name: '',
      vars: {},
    },
    d1_databases: [],
    r2_buckets: [],
    kv_namespaces: [],
    routes: [],
  };

  const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
  if (nameMatch) result.name = nameMatch[1];

  const mainMatch = content.match(/^main\s*=\s*"([^"]+)"/m);
  if (mainMatch) result.main = mainMatch[1];

  const compatMatch = content.match(/^compatibility_date\s*=\s*"([^"]+)"/m);
  if (compatMatch) result.compatibility_date = compatMatch[1];

  const accountMatch = content.match(/^account_id\s*=\s*"([^"]+)"/m);
  if (accountMatch) result.account_id = accountMatch[1];

  const varsSection = content.match(/\[vars\]([\s\S]*?)(?=\[|$)/);
  if (varsSection) {
    const varMatches = varsSection[1].matchAll(/^(\w+)\s*=\s*"([^"]*)"/gm);
    for (const m of varMatches) {
      result.vars[m[1]] = m[2];
    }
  }

  const prodVarsSection = content.match(/\[env\.production\.vars\]([\s\S]*?)(?=\[|$)/);
  if (prodVarsSection) {
    const varMatches = prodVarsSection[1].matchAll(/^(\w+)\s*=\s*"([^"]*)"/gm);
    for (const m of varMatches) {
      result.production.vars[m[1]] = m[2];
    }
  }

  const prodNameMatch = content.match(/\[env\.production\][\s\S]*?name\s*=\s*"([^"]+)"/);
  if (prodNameMatch) result.production.name = prodNameMatch[1];

  const d1Matches = content.matchAll(
    /\[\[(?:env\.production\.)?d1_databases\]\]\s*\nbinding\s*=\s*"([^"]+)"\s*\ndatabase_name\s*=\s*"([^"]+)"\s*\ndatabase_id\s*=\s*"([^"]+)"/g
  );
  for (const m of d1Matches) {
    result.d1_databases.push({ binding: m[1], database_name: m[2], database_id: m[3] });
  }

  const r2Matches = content.matchAll(
    /\[\[(?:env\.production\.)?r2_buckets\]\]\s*\nbinding\s*=\s*"([^"]+)"\s*\nbucket_name\s*=\s*"([^"]+)"/g
  );
  for (const m of r2Matches) {
    result.r2_buckets.push({ binding: m[1], bucket_name: m[2] });
  }

  const kvMatches = content.matchAll(
    /\[\[(?:env\.production\.)?kv_namespaces\]\]\s*\nbinding\s*=\s*"([^"]+)"\s*\nid\s*=\s*"([^"]+)"/g
  );
  for (const m of kvMatches) {
    result.kv_namespaces.push({ binding: m[1], id: m[2] });
  }

  return result;
}

function runWranglerCommand(args, cwd, stdin = null) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['wrangler', ...args], {
      cwd,
      shell: false,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    if (stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout || stderr);
      } else {
        reject(new Error(stderr || stdout || `Command failed with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

export default router;
