/**
 * Centralized AI Logger
 * 
 * 모든 AI 서비스에서 사용하는 통합 로깅 시스템
 */

import type { AILogEntry, LogLevel, ProviderId, CircuitBreakerState } from '../types/ai';
import { getAIConfig } from './config';

// ============================================================================
// Logger Implementation
// ============================================================================

class AILogger {
  private static instance: AILogger;
  
  private constructor() {}
  
  static getInstance(): AILogger {
    if (!AILogger.instance) {
      AILogger.instance = new AILogger();
    }
    return AILogger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const config = getAIConfig();
    if (!config.logging.enabled) return false;
    
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(config.logging.level);
    const msgLevelIndex = levels.indexOf(level);
    
    return msgLevelIndex >= configLevelIndex;
  }

  private formatEntry(entry: AILogEntry): string {
    return JSON.stringify(entry);
  }

  private log(level: LogLevel, entry: Omit<AILogEntry, 'timestamp' | 'level'>): void {
    if (!this.shouldLog(level)) return;

    const fullEntry: AILogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      level,
    };

    const formatted = this.formatEntry(fullEntry);

    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.log(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  debug(service: string, operation: string, metadata?: Record<string, unknown>): void {
    this.log('debug', { service, operation, metadata });
  }

  info(service: string, operation: string, metadata?: Record<string, unknown>): void {
    this.log('info', { service, operation, metadata });
  }

  warn(service: string, operation: string, metadata?: Record<string, unknown>): void {
    this.log('warn', { service, operation, metadata });
  }

  error(service: string, operation: string, error: Error | string, metadata?: Record<string, unknown>): void {
    this.log('error', {
      service,
      operation,
      error: error instanceof Error ? error.message : error,
      metadata,
    });
  }

  // ============================================================================
  // Specialized Logging Methods
  // ============================================================================

  /**
   * Log an AI request
   */
  logRequest(params: {
    service: string;
    operation: string;
    requestId: string;
    provider: ProviderId;
    model: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.log('info', {
      service: params.service,
      operation: params.operation,
      requestId: params.requestId,
      provider: params.provider,
      model: params.model,
      metadata: params.metadata,
    });
  }

  /**
   * Log an AI response
   */
  logResponse(params: {
    service: string;
    operation: string;
    requestId: string;
    provider: ProviderId;
    model: string;
    duration: number;
    success: boolean;
    error?: string;
    metadata?: Record<string, unknown>;
  }): void {
    const level: LogLevel = params.success ? 'info' : 'error';
    this.log(level, {
      service: params.service,
      operation: params.operation,
      requestId: params.requestId,
      provider: params.provider,
      model: params.model,
      duration: params.duration,
      error: params.error,
      metadata: params.metadata,
    });
  }

  /**
   * Log circuit breaker state changes
   */
  logCircuitBreaker(service: string, state: CircuitBreakerState, event: 'opened' | 'closed' | 'half-open'): void {
    const level: LogLevel = event === 'opened' ? 'warn' : 'info';
    this.log(level, {
      service,
      operation: 'circuit_breaker',
      metadata: {
        event,
        ...state,
      },
    });
  }

  /**
   * Log health check results
   */
  logHealthCheck(service: string, healthy: boolean, details?: Record<string, unknown>): void {
    const level: LogLevel = healthy ? 'debug' : 'warn';
    this.log(level, {
      service,
      operation: 'health_check',
      metadata: {
        healthy,
        ...details,
      },
    });
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const aiLogger = AILogger.getInstance();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique request ID
 */
export function generateRequestId(prefix = 'req'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}
