import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { db } from '../db/connection.js';
import { CryptoUtils } from '../services/crypto.js';
import { CacheService } from '../services/redis.js';
import { authenticateRequest } from '../middleware/auth.js';

interface AuthBody {
  username?: string;
  password?: string;
}

const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. Signup Route
  fastify.post('/signup', async (request, reply) => {
    const { username, password } = request.body as AuthBody;

    if (!username || !password || username.trim().length < 3 || password.length < 6) {
      return reply.status(400).send({
        status: 'error',
        message: 'Invalid input. Username (min 3 chars), password (min 6 chars) required.'
      });
    }

    try {
      const passwordHash = CryptoUtils.hashPassword(password);
      
      const insert = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
      insert.run(username.trim(), passwordHash);

      const token = fastify.jwt.sign({ username: username.trim() }, { expiresIn: '1h' });
      return reply.status(201).send({
        status: 'success',
        data: { token, username: username.trim() },
      });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return reply.status(409).send({ status: 'error', message: 'Username is already taken.' });
      }
      return reply.status(500).send({ status: 'error', message: 'Internal server registration failure.' });
    }
  });

  // 2. Login Route
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body as AuthBody;

    if (!username || !password) {
      return reply.status(400).send({ status: 'error', message: 'Credentials required.' });
    }

    try {
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as any;
      if (!user || !CryptoUtils.verifyPassword(password, user.password_hash)) {
        return reply.status(401).send({ status: 'error', message: 'Invalid username or password.' });
      }

      const token = fastify.jwt.sign({ username: user.username }, { expiresIn: '1h' });
      return reply.status(200).send({
        status: 'success',
        data: { token, username: user.username },
      });
    } catch (err) {
      return reply.status(500).send({ status: 'error', message: 'Internal login error.' });
    }
  });

  // 3. Logout Route
  fastify.post('/logout', { preHandler: authenticateRequest }, async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        return reply.status(400).send({ status: 'error', message: 'Token required.' });
      }

      const token = authHeader.replace(/^Bearer\s+/, '');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Decode token to find expiration date for blacklisting duration
      const decoded = fastify.jwt.decode<{ exp?: number }>(token);
      let ttlSeconds = 3600; // Default blacklisting window of 1 hour

      if (decoded && decoded.exp) {
        const remainingTime = decoded.exp - Math.floor(Date.now() / 1000);
        if (remainingTime > 0) {
          ttlSeconds = remainingTime;
        }
      }

      // Add to blacklisted set
      await CacheService.blacklistToken(tokenHash, ttlSeconds);

      return reply.status(200).send({ status: 'success', message: 'Session terminated successfully.' });
    } catch (err) {
      return reply.status(500).send({ status: 'error', message: 'Failed to safely sign out.' });
    }
  });
};

export default authRoutes;
