import type { Env } from '../types';
import {
  appendDomainOutboxEvent,
  claimDomainOutboxEvents,
  getDomainOutboxEventByIdempotencyKey,
  markDomainOutboxFailed,
  markDomainOutboxProcessed,
  reviveDomainOutboxEvent,
} from './domain-outbox';

export const NOTIFICATION_DELIVERY_STREAM = 'notification.delivery';
const NOTIFICATION_MAX_RETRIES = 8;

export type NotificationDeliveryPayload = {
  event: 'notification';
  type: 'success' | 'error' | string;
  title: string;
  message: string;
  userId: string;
  sourceId: string;
  payload?: Record<string, unknown>;
};

async function appendOrReuseNotification(env: Env, input: {
  aggregateId: string;
  eventType: string;
  payload: NotificationDeliveryPayload;
  idempotencyKey: string;
}) {
  try {
    return await appendDomainOutboxEvent(env.DB, {
      stream: NOTIFICATION_DELIVERY_STREAM,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'notification outbox append failed';
    if (!message.includes('UNIQUE constraint')) {
      throw error;
    }

    const existing = await getDomainOutboxEventByIdempotencyKey(
      env.DB,
      NOTIFICATION_DELIVERY_STREAM,
      input.idempotencyKey
    );
    if (!existing) {
      throw error;
    }
    if (existing.status === 'dead_letter') {
      await reviveDomainOutboxEvent(env.DB, existing.id);
      return { ...existing, status: 'pending' as const, retryCount: 0 };
    }
    return existing;
  }
}

export async function enqueueNotificationDelivery(
  env: Env,
  payload: NotificationDeliveryPayload,
  options: { idempotencyKey?: string } = {}
) {
  return appendOrReuseNotification(env, {
    aggregateId: payload.sourceId,
    eventType: 'notification.deliver',
    payload,
    idempotencyKey:
      options.idempotencyKey || `notification:${payload.sourceId}:${payload.type}`,
  });
}

async function deliverNotification(
  env: Env,
  payload: NotificationDeliveryPayload,
  idempotencyKey?: string | null
) {
  if (!env.BACKEND_ORIGIN) {
    throw new Error('BACKEND_ORIGIN not configured');
  }
  if (!env.BACKEND_KEY) {
    throw new Error('BACKEND_KEY not configured');
  }

  const backendOrigin = env.BACKEND_ORIGIN.replace(/\/$/, '');
  const response = await fetch(`${backendOrigin}/api/v1/notifications/outbox/internal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Backend-Key': env.BACKEND_KEY,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Notification delivery failed: ${response.status}`);
  }
}

export async function flushNotificationOutbox(env: Env, options: { limit?: number } = {}) {
  const events = await claimDomainOutboxEvents(env.DB, {
    stream: NOTIFICATION_DELIVERY_STREAM,
    limit: options.limit ?? 25,
  });

  let processed = 0;
  let deadLettered = 0;

  for (const event of events) {
    try {
      if (event.eventType !== 'notification.deliver') {
        throw new Error(`Unsupported notification event type: ${event.eventType}`);
      }
      await deliverNotification(
        env,
        event.payload as NotificationDeliveryPayload,
        event.idempotencyKey
      );
      await markDomainOutboxProcessed(env.DB, event.id);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Notification delivery failed';
      const result = await markDomainOutboxFailed(env.DB, {
        id: event.id,
        lastError: message,
        maxRetries: NOTIFICATION_MAX_RETRIES,
      });
      if (result.status === 'dead_letter') {
        deadLettered += 1;
      }
    }
  }

  return {
    processed,
    deadLettered,
    scanned: events.length,
  };
}
