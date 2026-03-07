type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isDev = import.meta.env.DEV;
const minLevel = isDev ? 'debug' : 'warn';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

function formatLog(entry: LogEntry): string {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
  return entry.data !== undefined
    ? `${prefix} ${entry.message}`
    : `${prefix} ${entry.message}`;
}

function createLogEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    data,
  };
}

export const logger = {
  debug(message: string, data?: unknown): void {
    if (!shouldLog('debug')) return;
    const entry = createLogEntry('debug', message, data);
    console.debug(formatLog(entry), data !== undefined ? data : '');
  },

  info(message: string, data?: unknown): void {
    if (!shouldLog('info')) return;
    const entry = createLogEntry('info', message, data);
    console.info(formatLog(entry), data !== undefined ? data : '');
  },

  warn(message: string, data?: unknown): void {
    if (!shouldLog('warn')) return;
    const entry = createLogEntry('warn', message, data);
    console.warn(formatLog(entry), data !== undefined ? data : '');
  },

  error(message: string, error?: unknown): void {
    if (!shouldLog('error')) return;
    const entry = createLogEntry('error', message, error);
    console.error(formatLog(entry), error instanceof Error ? error : '');
  },
};

export default logger;
