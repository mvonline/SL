import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { db } from '../db/connection.js';

interface StationsQuery {
  minLat?: string;
  maxLat?: string;
  minLon?: string;
  maxLon?: string;
  zoom?: string;
  /** When true, omit bus stops (keeps map fast; buses remain in DB for search) */
  forMap?: string;
}

const stationsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    const raw = (q || '').trim();
    if (raw.length < 1) {
      return reply.status(200).send({
        status: 'success',
        data: [],
      });
    }
    // Drop LIKE wildcards from user input for predictable matching
    const term = raw.replace(/[%_]/g, '').trim();
    if (term.length < 1) {
      return reply.status(200).send({
        status: 'success',
        data: [],
      });
    }
    const pattern = `%${term}%`;

    try {
      const statement = db.prepare(
        `SELECT * FROM stations WHERE name LIKE ? COLLATE NOCASE ORDER BY is_major DESC, name ASC LIMIT 40`
      );
      const results = statement.all(pattern);
      return reply.status(200).send({
        status: 'success',
        data: results,
      });
    } catch (err) {
      console.error('Failed to search stations:', err);
      return reply.status(500).send({
        status: 'error',
        message: 'Station search failed.',
      });
    }
  });

  fastify.get('/', async (request, reply) => {
    const { minLat, maxLat, minLon, maxLon, forMap } = request.query as StationsQuery;

    let queryStr = 'SELECT * FROM stations';
    const params: any[] = [];
    const conditions: string[] = [];

    if (minLat && maxLat && minLon && maxLon) {
      conditions.push('latitude >= ? AND latitude <= ? AND longitude >= ? AND longitude <= ?');
      params.push(parseFloat(minLat), parseFloat(maxLat), parseFloat(minLon), parseFloat(maxLon));
    }

    // Map view: metro + train + ferry only — skip thousands of bus quays
    if (forMap === 'true' || forMap === '1') {
      conditions.push("stop_type IN ('METRO', 'TRAIN', 'FERRY')");
    }

    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }

    // Order alphabetically or by priority
    queryStr += ' ORDER BY is_major DESC, name ASC';

    try {
      const statement = db.prepare(queryStr);
      const results = statement.all(...params);
      return reply.status(200).send({
        status: 'success',
        count: results.length,
        data: results
      });
    } catch (err) {
      console.error('Failed to query thinned stations from SQLite:', err);
      return reply.status(500).send({
        status: 'error',
        message: 'Database query failure.'
      });
    }
  });
};

export default stationsRoutes;
