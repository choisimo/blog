import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInternalAuthHeader,
  verifyInternalRequest,
} from '../src/admission.js';

test('internal auth headers validate only for the original method and path', () => {
  const secret = 'terminal-secret';
  const header = createInternalAuthHeader(secret, 'POST', '/internal/leases/open');

  assert.equal(
    verifyInternalRequest({
      headerValue: header,
      secret,
      method: 'POST',
      path: '/internal/leases/open',
    }),
    true
  );

  assert.equal(
    verifyInternalRequest({
      headerValue: header,
      secret,
      method: 'GET',
      path: '/internal/leases/open',
    }),
    false
  );
});
