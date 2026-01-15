import { Router } from 'express';
import { config } from '../config.js';
import requireAdmin from '../middleware/adminAuth.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const router = Router();

const WORKERS_ROOT = path.join(config.content.repoRoot, 'workers');

const WORKERS_CONFIG = [
  {
    id: 'api-gateway',
    name: 'Blog API Gateway',
    description: '메인 블로그 API Worker (blog-api-gateway)',
    path: 'api-gateway',
    wranglerPath: 'api-gateway/wrangler.toml',
    hasProduction: true,
  },
  {
    id: 'r2-gateway',
    name: 'R2 Gateway',
    description: 'R2 스토리지 게이트웨이',
    path: 'r2-gateway',
    wranglerPath: 'r2-gateway/wrangler.toml',
    hasProduction: true,
  },
  {
    id: 'terminal-gateway',
    name: 'Terminal Gateway',
    description: '터미널 WebSocket 게이트웨이',
    path: 'terminal-gateway',
    wranglerPath: 'terminal-gateway/wrangler.toml',
    hasProduction: true,
  },
];

const KNOWN_SECRETS = [
  { key: 'JWT_SECRET', description: 'JWT 서명 키', workers: ['api-gateway', 'terminal-gateway'] },
  { key: 'GEMINI_API_KEY', description: 'Google Gemini API 키', workers: ['api-gateway'] },
  { key: 'ADMIN_USERNAME', description: '관리자 사용자명', workers: ['api-gateway'] },
  { key: 'ADMIN_PASSWORD', description: '관리자 비밀번호', workers: ['api-gateway'] },
  { key: 'ADMIN_EMAIL', description: '관리자 이메일 (OTP)', workers: ['api-gateway'] },
  { key: 'OPENROUTER_API_KEY', description: 'OpenRouter API 키', workers: ['api-gateway'] },
  { key: 'BACKEND_ORIGIN', description: '백엔드 서버 URL', workers: ['api-gateway'] },
  { key: 'BACKEND_SECRET_KEY', description: '백엔드 인증 키', workers: ['api-gateway'] },
  { key: 'RESEND_API_KEY', description: 'Resend.com API 키', workers: ['api-gateway'] },
  { key: 'INTERNAL_CALLER_KEY', description: 'R2 내부 호출 키', workers: ['r2-gateway'] },
  { key: 'ORIGIN_SECRET_KEY', description: 'Origin 인증 키', workers: ['terminal-gateway'] },
];

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

router.post('/:workerId/vars', requireAdmin, async (req, res) => {
  const { workerId } = req.params;
  const { vars, env = 'development' } = req.body;
  const worker = WORKERS_CONFIG.find((w) => w.id === workerId);

  if (!worker) {
    return res.status(404).json({ ok: false, error: 'Worker not found' });
  }

  try {
    const wranglerPath = path.join(WORKERS_ROOT, worker.wranglerPath);
    let content = await fs.readFile(wranglerPath, 'utf8');

    for (const [key, value] of Object.entries(vars)) {
      if (env === 'development') {
        const regex = new RegExp(`^(\\[vars\\][\\s\\S]*?)${key}\\s*=\\s*"[^"]*"`, 'm');
        if (regex.test(content)) {
          content = content.replace(regex, `$1${key} = "${value}"`);
        }
      } else if (env === 'production') {
        const regex = new RegExp(
          `^(\\[env\\.production\\.vars\\][\\s\\S]*?)${key}\\s*=\\s*"[^"]*"`,
          'm'
        );
        if (regex.test(content)) {
          content = content.replace(regex, `$1${key} = "${value}"`);
        }
      }
    }

    await fs.writeFile(wranglerPath, content, 'utf8');

    res.json({ ok: true, data: { message: 'Variables updated', path: wranglerPath } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/:workerId/secret', requireAdmin, async (req, res) => {
  const { workerId } = req.params;
  const { key, value, env = 'production' } = req.body;
  const worker = WORKERS_CONFIG.find((w) => w.id === workerId);

  if (!worker) {
    return res.status(404).json({ ok: false, error: 'Worker not found' });
  }

  if (!key || !value) {
    return res.status(400).json({ ok: false, error: 'key and value required' });
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

router.post('/:workerId/deploy', requireAdmin, async (req, res) => {
  const { workerId } = req.params;
  const { env = 'production', dryRun = false } = req.body;
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
      shell: true,
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
