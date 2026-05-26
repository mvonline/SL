import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { runMigrations } from './db/connection.js';
import { SeedingCronService } from './services/cron.js';

// Route Imports
import authRoutes from './routes/auth.js';
import stationsRoutes from './routes/stations.js';
import departuresRoutes from './routes/departures.js';
import routingRoutes from './routes/routing.js';
import adminRoutes from './routes/admin.js';

const fastify = Fastify({
  logger: true
});

// Base Server Health Check Endpoint
fastify.get('/health', async () => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

// Bootstrap Server
const startServer = async () => {
  try {
    // 1. CORS — local dev, GitHub Pages, and FRONTEND_URL (origin only; path e.g. /SL/ is ignored)
    const frontendOrigin = (() => {
      const raw = process.env.FRONTEND_URL?.trim();
      if (!raw) return undefined;
      try {
        return new URL(raw).origin;
      } catch {
        return raw.replace(/\/$/, '');
      }
    })();
    await fastify.register(cors, {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') {
          return cb(null, true);
        }
        if (frontendOrigin && origin === frontendOrigin) return cb(null, true);
        if (/^https:\/\/[\w-]+\.github\.io$/.test(origin)) return cb(null, true);
        cb(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });

    // 2. Register JWT Authentication plugin
    await fastify.register(jwt, {
      secret: process.env.JWT_SECRET || 'super_secret_signing_key_for_stockholm_transit_1234!'
    });

    // 3. Register Application Routers
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(stationsRoutes, { prefix: '/api/stations' });
    await fastify.register(departuresRoutes, { prefix: '/api/departures' });
    await fastify.register(routingRoutes, { prefix: '/api/routing' });
    await fastify.register(adminRoutes, { prefix: '/api/admin' });

    // A. Run database tables creation
    runMigrations();

    // B. Initialize the station caching cron & initial data seeder
    SeedingCronService.initialize();

    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    // Bind to 0.0.0.0 is MANDATORY inside Docker containers
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`BFF Server successfully booted on http://0.0.0.0:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

startServer();

