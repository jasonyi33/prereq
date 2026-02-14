/**
 * Shared Redis client for the Next.js frontend.
 * Falls back gracefully when REDIS_URL is not set (local dev).
 */

import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

let redis: Redis | null = null;

if (redisUrl) {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: 2000,
    lazyConnect: true,
  });

  redis.connect().catch(() => {
    console.warn("[redis] Frontend Redis connection failed, running without cache");
    redis = null;
  });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    if (val) return JSON.parse(val) as T;
  } catch {
    // Redis unavailable — ignore
  }
  return null;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number = 10): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Redis unavailable — ignore
  }
}