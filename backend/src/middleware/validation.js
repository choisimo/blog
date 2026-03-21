/**
 * Request Validation Middleware
 *
 * Provides Zod schema validation for Express request body, query, and params.
 * Returns 422 with structured validation errors on failure.
 *
 * @module middleware/validation
 */

import { ZodError } from 'zod';

function formatValidationErrors(error) {
  return error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

function handleValidationError(res, error, location) {
  const details = formatValidationErrors(error);
  return res.status(422).json({
    ok: false,
    error: {
      message: `Invalid ${location}`,
      code: 'VALIDATION_ERROR',
      details,
    },
  });
}

/**
 * Validate request body against a Zod schema
 * @param {import('zod').ZodSchema} schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return handleValidationError(res, result.error, 'request body');
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validate request query params against a Zod schema
 * @param {import('zod').ZodSchema} schema
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return handleValidationError(res, result.error, 'query parameters');
    }
    req.query = result.data;
    next();
  };
}

/**
 * Validate request URL params against a Zod schema
 * @param {import('zod').ZodSchema} schema
 */
export function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return handleValidationError(res, result.error, 'URL parameters');
    }
    req.params = result.data;
    next();
  };
}

/**
 * Validate multiple request parts at once
 * @param {{ body?: import('zod').ZodSchema, query?: import('zod').ZodSchema, params?: import('zod').ZodSchema }} schemas
 */
export function validate(schemas) {
  return (req, res, next) => {
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        return handleValidationError(res, result.error, 'URL parameters');
      }
      req.params = result.data;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        return handleValidationError(res, result.error, 'query parameters');
      }
      req.query = result.data;
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        return handleValidationError(res, result.error, 'request body');
      }
      req.body = result.data;
    }

    next();
  };
}
