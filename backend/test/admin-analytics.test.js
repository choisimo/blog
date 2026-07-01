import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'admin-analytics-test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
process.env.APP_ENV = process.env.APP_ENV || 'test';
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || 'gpt-4.1-mini';

const { parseVisitPagination } = await import('../src/routes/adminAnalytics.js');

test('admin analytics visit pagination clamps expensive query inputs', () => {
  assert.deepEqual(parseVisitPagination({ limit: '999999', offset: '999999999' }), {
    limit: 200,
    offset: 100000,
  });
});

test('admin analytics visit pagination normalizes invalid and negative inputs', () => {
  assert.deepEqual(parseVisitPagination({ limit: 'not-a-number', offset: '-20' }), {
    limit: 100,
    offset: 0,
  });
  assert.deepEqual(parseVisitPagination({ limit: '0', offset: '15.5' }), {
    limit: 1,
    offset: 0,
  });
});
