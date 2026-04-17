import { describe, expect, it } from 'vitest';

import {
  buildRouteBoundaryHeaders,
  isBackendOwnedPath,
  isWorkerOwnedPath,
  matchRouteBoundary,
} from '@blog/shared/contracts/service-boundaries';

describe('route boundary contract', () => {
  it('resolves backend-owned chat message operations at route level', () => {
    const boundary = matchRouteBoundary({
      pathname: '/api/v1/chat/session/session-123/message',
      method: 'POST',
    });

    expect(boundary).toMatchObject({
      id: 'chat.message',
      owner: 'backend-owned',
      boundaryId: 'chat',
    });
    expect(isBackendOwnedPath('/api/v1/chat/session/session-123/message', 'POST')).toBe(true);
  });

  it('resolves worker-owned chat feed operations at route level', () => {
    const headers = buildRouteBoundaryHeaders(
      {
        pathname: '/api/v1/chat/session/session-123/lens-feed',
        method: 'POST',
      },
      {
        responder: 'worker',
        edgeMode: 'native',
        originMode: 'worker',
      },
    );

    expect(headers).toMatchObject({
      'X-Route-Boundary-Id': 'chat.feed.lens',
      'X-Route-Owner': 'worker-owned',
      'X-Route-Responder': 'worker',
    });
    expect(isWorkerOwnedPath('/api/v1/chat/session/session-123/lens-feed', 'POST')).toBe(true);
  });

  it('resolves backend-owned rag index operations inside the worker-owned rag service boundary', () => {
    const boundary = matchRouteBoundary({
      pathname: '/api/v1/rag/index/doc-123',
      method: 'DELETE',
    });

    expect(boundary).toMatchObject({
      id: 'rag.index.delete',
      owner: 'backend-owned',
      boundaryId: 'rag',
    });
    expect(isBackendOwnedPath('/api/v1/rag/index/doc-123', 'DELETE')).toBe(true);
  });

  it('resolves backend-owned admin log history operations behind the worker proxy', () => {
    const headers = buildRouteBoundaryHeaders(
      {
        pathname: '/api/v1/admin/logs',
        method: 'GET',
      },
      {
        responder: 'worker-proxy',
        edgeMode: 'proxy',
        originMode: 'backend',
      },
    );

    expect(headers).toMatchObject({
      'X-Route-Boundary-Id': 'admin-logs.list',
      'X-Route-Owner': 'backend-owned',
      'X-Route-Responder': 'worker-proxy',
    });
    expect(isBackendOwnedPath('/api/v1/admin/logs', 'GET')).toBe(true);
  });

  it('falls back to service boundaries for non-specialized paths', () => {
    const headers = buildRouteBoundaryHeaders(
      {
        pathname: '/api/v1/memos/session-123',
        method: 'GET',
      },
      {
        responder: 'worker',
      },
    );

    expect(headers).toMatchObject({
      'X-Route-Boundary-Id': 'memos',
      'X-Route-Owner': 'worker-owned',
    });
  });
});
