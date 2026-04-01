import { EventEmitter } from 'node:events';
import { SERVER } from '../config/constants.js';

const LEVEL_PRIORITY = { error: 0, warn: 1, info: 2, debug: 3 };

export const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(50);

function resolveMinLevel() {
  const env = (process.env.LOG_LEVEL || SERVER.LOG_LEVEL || 'info').toLowerCase();
  return LEVEL_PRIORITY[env] ?? LEVEL_PRIORITY.info;
}

function shouldLog(level) {
  return (LEVEL_PRIORITY[level] ?? 99) <= resolveMinLevel();
}

function write(level, service, context, message, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    pid: process.pid,
    ...context,
    message,
    ...data,
  };

  const line = JSON.stringify(entry) + '\n';
  if (level === 'error') {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }

  logEmitter.emit('log', entry);

  if (isPgEnabled()) {
    persistLogAsync(entry).catch(() => {});
  }
}

let _pgEnabled = false;

export function enablePgLogs() {
  _pgEnabled = true;
}

function isPgEnabled() {
  return _pgEnabled && Boolean(process.env.DATABASE_URL);
}

async function persistLogAsync(entry) {
  try {
    const { insertServerLog } = await import('../repositories/analytics.repository.js');
    const { level, service, message, timestamp, pid, ...rest } = entry;
    await insertServerLog({ level, service, message, context: Object.keys(rest).length ? rest : null });
  } catch {
  }
}

export function createLogger(service) {
  return {
    info(ctx, msg, data = {}) {
      if (shouldLog('info')) write('info', service, ctx, msg, data);
    },
    warn(ctx, msg, data = {}) {
      if (shouldLog('warn')) write('warn', service, ctx, msg, data);
    },
    error(ctx, msg, data = {}) {
      if (shouldLog('error')) write('error', service, ctx, msg, data);
    },
    debug(ctx, msg, data = {}) {
      if (shouldLog('debug')) write('debug', service, ctx, msg, data);
    },
    child(extraContext) {
      const merged = { ...extraContext };
      return {
        info(ctx, msg, data = {}) {
          if (shouldLog('info')) write('info', service, { ...merged, ...ctx }, msg, data);
        },
        warn(ctx, msg, data = {}) {
          if (shouldLog('warn')) write('warn', service, { ...merged, ...ctx }, msg, data);
        },
        error(ctx, msg, data = {}) {
          if (shouldLog('error')) write('error', service, { ...merged, ...ctx }, msg, data);
        },
        debug(ctx, msg, data = {}) {
          if (shouldLog('debug')) write('debug', service, { ...merged, ...ctx }, msg, data);
        },
      };
    },
  };
}

export const logger = createLogger('backend');

export default createLogger;
