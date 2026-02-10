/**
 * Redis Client Module
 * 
 * Provides connection pooling, pub/sub, and streams support for the blog backend.
 * Used for:
 *   - AI task queue (async processing)
 *   - Event-driven communication between services
 *   - Caching and rate limiting
 */

import { createClient } from 'redis';
import { config } from '../config.js';

let _client = null;
let _subscriber = null;
let _isConnecting = false;
let _connectionPromise = null;

const getRedisUrl = () => config.redis?.url || process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

function buildRedisUrl() {
  const redisUrl = getRedisUrl();
  if (redisUrl.includes('@') || !REDIS_PASSWORD) {
    return redisUrl;
  }
  const url = new URL(redisUrl);
  url.password = REDIS_PASSWORD;
  return url.toString();
}

export async function getRedisClient() {
  if (_client?.isOpen) {
    return _client;
  }

  if (_isConnecting && _connectionPromise) {
    return _connectionPromise;
  }

  _isConnecting = true;
  _connectionPromise = (async () => {
    try {
      _client = createClient({
        url: buildRedisUrl(),
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('[Redis] Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      _client.on('error', (err) => {
        console.error('[Redis] Client error:', err.message);
      });

      _client.on('reconnecting', () => {
        console.log('[Redis] Reconnecting...');
      });

      await _client.connect();
      console.log('[Redis] Connected successfully');
      return _client;
    } finally {
      _isConnecting = false;
      _connectionPromise = null;
    }
  })();

  return _connectionPromise;
}

export async function getRedisSubscriber() {
  if (_subscriber?.isOpen) {
    return _subscriber;
  }

  _subscriber = createClient({
    url: buildRedisUrl(),
  });

  _subscriber.on('error', (err) => {
    console.error('[Redis:Subscriber] Error:', err.message);
  });

  await _subscriber.connect();
  console.log('[Redis:Subscriber] Connected');
  return _subscriber;
}

export async function closeRedis() {
  const promises = [];
  
  if (_client?.isOpen) {
    promises.push(_client.quit().catch(() => _client.disconnect()));
  }
  
  if (_subscriber?.isOpen) {
    promises.push(_subscriber.quit().catch(() => _subscriber.disconnect()));
  }

  await Promise.all(promises);
  _client = null;
  _subscriber = null;
  console.log('[Redis] Connections closed');
}

export async function isRedisAvailable() {
  try {
    const client = await getRedisClient();
    await client.ping();
    return true;
  } catch {
    return false;
  }
}
