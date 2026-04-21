import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInternalAuthHeader,
  verifyInternalRequest,
} from '../src/admission.js';

test('internal auth headers validate only for the original method and path', () => {
  const secret = 'terminal-secret';
  const header = createInternalAuthHeader(secret, 'GET', '/stats');

  assert.equal(
    verifyInternalRequest({
      headerValue: header,
      secret,
      method: 'GET',
      path: '/stats',
    }),
    true
  );

  assert.equal(
    verifyInternalRequest({
      headerValue: header,
      secret,
      method: 'POST',
      path: '/stats',
    }),
    false
  );
});
