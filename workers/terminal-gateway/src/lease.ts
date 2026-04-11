import { DurableObject } from 'cloudflare:workers';
import type { Env } from './types';

const LEASE_STORAGE_KEY = 'lease';
const ACTIVE_LEASE_WINDOW_MS = 90_000;

type LeaseStatus = 'claimed' | 'open';

type LeaseRecord = {
  userId: string;
  leaseId: string;
  clientIP: string;
  claimedAt: number;
  openedAt: number | null;
  lastActivity: number;
  status: LeaseStatus;
};

type LeasePayload = {
  userId: string;
  leaseId: string;
  clientIP?: string;
};

function jsonResponse(body: unknown, status: number = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function isLeaseActive(record: LeaseRecord, now: number): boolean {
  return now - record.lastActivity < ACTIVE_LEASE_WINDOW_MS;
}

function isValidLeasePayload(payload: LeasePayload | null): payload is LeasePayload {
  return Boolean(
    payload &&
      typeof payload.userId === 'string' &&
      payload.userId &&
      typeof payload.leaseId === 'string' &&
      payload.leaseId
  );
}

export class TerminalLeaseObject extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: 'POST' },
      });
    }

    const url = new URL(request.url);
    const payload = await request.json<LeasePayload>().catch(() => null);
    if (!isValidLeasePayload(payload)) {
      return jsonResponse(
        {
          ok: false,
          error: 'Invalid lease payload',
        },
        400
      );
    }

    switch (url.pathname) {
      case '/claim':
        return this.handleClaim(payload);
      case '/open':
        return this.handleOpen(payload);
      case '/heartbeat':
        return this.handleHeartbeat(payload);
      case '/close':
        return this.handleClose(payload);
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  private async handleClaim(payload: LeasePayload): Promise<Response> {
    return this.ctx.storage.transaction(async (tx) => {
      const now = Date.now();
      const existing = await tx.get<LeaseRecord>(LEASE_STORAGE_KEY);
      if (existing && existing.leaseId !== payload.leaseId && isLeaseActive(existing, now)) {
        return jsonResponse(
          {
            ok: false,
            activeLeaseId: existing.leaseId,
          },
          409
        );
      }

      const nextRecord: LeaseRecord = {
        userId: payload.userId,
        leaseId: payload.leaseId,
        clientIP: payload.clientIP || existing?.clientIP || 'unknown',
        claimedAt: now,
        openedAt: null,
        lastActivity: now,
        status: 'claimed',
      };
      await tx.put(LEASE_STORAGE_KEY, nextRecord);

      return jsonResponse({ ok: true, leaseId: payload.leaseId });
    });
  }

  private async handleOpen(payload: LeasePayload): Promise<Response> {
    return this.ctx.storage.transaction(async (tx) => {
      const now = Date.now();
      const existing = await tx.get<LeaseRecord>(LEASE_STORAGE_KEY);
      if (!existing) {
        return jsonResponse({ ok: false, error: 'Lease not found' }, 404);
      }
      if (existing.leaseId !== payload.leaseId) {
        return jsonResponse({ ok: false, error: 'Lease mismatch' }, 409);
      }

      const nextRecord: LeaseRecord = {
        ...existing,
        lastActivity: now,
        openedAt: existing.openedAt || now,
        status: 'open',
      };
      await tx.put(LEASE_STORAGE_KEY, nextRecord);

      return jsonResponse({ ok: true, leaseId: payload.leaseId });
    });
  }

  private async handleHeartbeat(payload: LeasePayload): Promise<Response> {
    return this.ctx.storage.transaction(async (tx) => {
      const existing = await tx.get<LeaseRecord>(LEASE_STORAGE_KEY);
      if (!existing) {
        return jsonResponse({ ok: false, error: 'Lease not found' }, 404);
      }
      if (existing.leaseId !== payload.leaseId) {
        return jsonResponse({ ok: false, error: 'Lease mismatch' }, 409);
      }

      await tx.put(LEASE_STORAGE_KEY, {
        ...existing,
        lastActivity: Date.now(),
        status: 'open',
      });

      return jsonResponse({ ok: true, leaseId: payload.leaseId });
    });
  }

  private async handleClose(payload: LeasePayload): Promise<Response> {
    return this.ctx.storage.transaction(async (tx) => {
      const existing = await tx.get<LeaseRecord>(LEASE_STORAGE_KEY);
      if (!existing) {
        return new Response(null, {
          status: 204,
          headers: {
            'Cache-Control': 'no-store',
          },
        });
      }
      if (existing.leaseId !== payload.leaseId) {
        return jsonResponse({ ok: false, error: 'Lease mismatch' }, 409);
      }

      await tx.delete(LEASE_STORAGE_KEY);
      return new Response(null, {
        status: 204,
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    });
  }
}

function getLeaseStub(env: Env, userId: string): DurableObjectStub {
  const id = env.TERMINAL_LEASES.idFromName(userId);
  return env.TERMINAL_LEASES.get(id);
}

export async function callLeaseMutation(
  env: Env,
  action: 'claim' | 'open' | 'heartbeat' | 'close',
  payload: LeasePayload
): Promise<Response> {
  return getLeaseStub(env, payload.userId).fetch(`https://terminal-lease/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function claimLease(
  env: Env,
  payload: LeasePayload
): Promise<boolean> {
  const response = await callLeaseMutation(env, 'claim', payload);
  if (response.status === 409) {
    return false;
  }
  if (!response.ok) {
    throw new Error(`Lease claim failed with status ${response.status}`);
  }
  return true;
}

export async function closeLease(
  env: Env,
  payload: LeasePayload
): Promise<void> {
  const response = await callLeaseMutation(env, 'close', payload);
  if (response.ok || response.status === 404) {
    return;
  }
  throw new Error(`Lease close failed with status ${response.status}`);
}
