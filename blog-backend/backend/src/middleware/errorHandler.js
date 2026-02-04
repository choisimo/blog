/**
 * Centralized Error Handler Middleware
 *
 * Provides consistent error responses across the API with:
 * - Structured JSON error format: { ok: false, error: { message, code, details? } }
 * - HTTP status code mapping for operational errors
 * - Zod validation error handling
 * - Stack trace hiding in production
 *
 * @module middleware/errorHandler
 */

import { ZodError } from 'zod';
import { SERVER } from '../config/constants.js';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base operational error class with HTTP status code
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details = null) {
    super(message, 400, 'BAD_REQUEST', details);
    this.name = 'BadRequestError';
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details = null) {
    super(message, 403, 'FORBIDDEN', details);
    this.name = 'ForbiddenError';
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends AppError {
  constructor(message = 'Not Found', details = null) {
    super(message, 404, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
  }
}

/**
 * 409 Conflict
 */
export class ConflictError extends AppError {
  constructor(message = 'Conflict', details = null) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

/**
 * 422 Unprocessable Entity (validation errors)
 */
export class ValidationError extends AppError {
  constructor(message = 'Validation Error', details = null) {
    super(message, 422, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * 429 Too Many Requests
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too Many Requests', details = null) {
    super(message, 429, 'RATE_LIMITED', details);
    this.name = 'RateLimitError';
  }
}

/**
 * 502 Bad Gateway (upstream service error)
 */
export class BadGatewayError extends AppError {
  constructor(message = 'Bad Gateway', details = null) {
    super(message, 502, 'BAD_GATEWAY', details);
    this.name = 'BadGatewayError';
  }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service Unavailable', details = null) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * 504 Gateway Timeout
 */
export class GatewayTimeoutError extends AppError {
  constructor(message = 'Gateway Timeout', details = null) {
    super(message, 504, 'GATEWAY_TIMEOUT', details);
    this.name = 'GatewayTimeoutError';
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

const isProduction = () => SERVER.ENV === 'production';

/**
 * Format Zod validation errors into a structured response
 */
function formatZodError(error) {
  const details = error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  return {
    message: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details,
  };
}

/**
 * Determine error response based on error type
 */
function getErrorResponse(err) {
  // Zod validation errors
  if (err instanceof ZodError) {
    return {
      statusCode: 422,
      body: formatZodError(err),
    };
  }

  // Our custom AppError classes
  if (err instanceof AppError) {
    const response = {
      message: err.message,
      code: err.code,
    };
    if (err.details) {
      response.details = err.details;
    }
    return {
      statusCode: err.statusCode,
      body: response,
    };
  }

  // Express body-parser JSON syntax errors
  if (err.type === 'entity.parse.failed') {
    return {
      statusCode: 400,
      body: {
        message: 'Invalid JSON',
        code: 'INVALID_JSON',
      },
    };
  }

  // Express body-parser size limit errors
  if (err.type === 'entity.too.large') {
    return {
      statusCode: 413,
      body: {
        message: 'Request body too large',
        code: 'PAYLOAD_TOO_LARGE',
      },
    };
  }

  // Generic errors with status property (from other middleware)
  if (err.status && err.status !== 500) {
    return {
      statusCode: err.status,
      body: {
        message: err.message || 'Request failed',
        code: err.code || 'REQUEST_FAILED',
      },
    };
  }

  // Unexpected errors - hide details in production
  return {
    statusCode: 500,
    body: {
      message: isProduction() ? 'Internal Server Error' : err.message,
      code: 'INTERNAL_ERROR',
    },
  };
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Express error handling middleware
 *
 * @example
 * // Register as last middleware
 * app.use(errorHandler);
 *
 * @example
 * // Throw errors in routes
 * throw new NotFoundError('Post not found');
 * throw new ValidationError('Invalid input', { field: 'email', issue: 'format' });
 */
export function errorHandler(err, req, res, next) {
  // Already sent response
  if (res.headersSent) {
    return next(err);
  }

  const { statusCode, body } = getErrorResponse(err);

  // Log based on severity
  if (statusCode >= 500) {
    console.error(`[error] ${statusCode} ${req.method} ${req.path}`, {
      error: err.message,
      stack: isProduction() ? undefined : err.stack,
      code: body.code,
    });
  } else if (statusCode >= 400) {
    console.warn(`[warn] ${statusCode} ${req.method} ${req.path}`, {
      error: err.message,
      code: body.code,
    });
  }

  // Send structured response
  res.status(statusCode).json({
    ok: false,
    error: body,
  });
}

/**
 * Async route wrapper to catch promise rejections
 *
 * @example
 * router.get('/posts/:id', asyncHandler(async (req, res) => {
 *   const post = await getPost(req.params.id);
 *   if (!post) throw new NotFoundError('Post not found');
 *   res.json({ ok: true, data: post });
 * }));
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler (404) - use before error handler
 */
export function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
}

export default errorHandler;
