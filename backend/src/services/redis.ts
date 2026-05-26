import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  console.log('Successfully connected to Redis container.');
});

redis.on('error', (err: Error) => {
  console.error('Redis connection error occurred:', err);
});

export const CacheService = {
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      const data = typeof value === 'string' ? value : JSON.stringify(value);
      await redis.setex(key, ttlSeconds, data);
    } catch (err) {
      console.error(`Failed to set Redis cache key ${key}:`, err);
    }
  },

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      try {
        return JSON.parse(data) as T;
      } catch {
        return data as unknown as T;
      }
    } catch (err) {
      console.error(`Failed to read Redis cache key ${key}:`, err);
      return null;
    }
  },

  async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (err) {
      console.error(`Failed to delete Redis cache key ${key}:`, err);
    }
  },

  async blacklistToken(tokenHash: string, ttlSeconds: number): Promise<void> {
    try {
      await redis.setex(`blacklist:${tokenHash}`, ttlSeconds, 'revoked');
    } catch (err) {
      console.error('Failed to blacklist JWT in Redis:', err);
    }
  },

  async isTokenBlacklisted(tokenHash: string): Promise<boolean> {
    try {
      const result = await redis.get(`blacklist:${tokenHash}`);
      return result === 'revoked';
    } catch (err) {
      console.error('Failed to verify token blacklist status in Redis:', err);
      return false;
    }
  },
};
