import { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { CacheService } from '../services/redis.js';

export async function authenticateRequest(request: FastifyRequest, reply: FastifyReply) {
  try {
    // 1. Verify standard JWT signature
    await request.jwtVerify();

    // 2. Perform check against the Redis token blacklist
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.status(401).send({ status: 'error', message: 'Missing Authorization header' });
    }

    const token = authHeader.replace(/^Bearer\s+/, '');
    
    // Hash the token string to use as a consistent, bounded length Redis lookup key
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const isBlacklisted = await CacheService.isTokenBlacklisted(tokenHash);
    if (isBlacklisted) {
      return reply.status(401).send({ status: 'error', message: 'Token has been revoked.' });
    }
  } catch (err) {
    return reply.status(401).send({ status: 'error', message: 'Unauthorized session.' });
  }
}
