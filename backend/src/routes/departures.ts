import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { db } from '../db/connection.js';
import { CacheService } from '../services/redis.js';
import { SlApiService } from '../services/slApi.js';
import { CostAnalyser } from '../services/costAnalyser.js';
import { resolveDeparturesSiteId } from '../services/journeyPlanner.js';

interface DeparturesParams {
  siteId: string;
}

const departuresRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get<{ Params: DeparturesParams }>('/:siteId', async (request, reply) => {
    const { siteId: rawSiteId } = request.params;

    if (!rawSiteId?.trim()) {
      return reply.status(400).send({
        status: 'error',
        message: 'Valid siteId parameter required.',
      });
    }

    const stationRow = db
      .prepare('SELECT id, name, latitude, longitude FROM stations WHERE id = ?')
      .get(rawSiteId) as
      | { id: string; name: string; latitude: number; longitude: number }
      | undefined;

    const siteId = await resolveDeparturesSiteId(
      rawSiteId,
      stationRow
        ? { name: stationRow.name, latitude: stationRow.latitude, longitude: stationRow.longitude }
        : undefined
    );

    if (!siteId) {
      return reply.status(400).send({
        status: 'error',
        message: 'Could not resolve station for departures.',
      });
    }

    const liveKey = `departures:live:${siteId}`;
    const fallbackKey = `departures:fallback:${siteId}`;

    // 1. Try reading from the Redis live cache (10-15s TTL)
    try {
      const cachedLive = await CacheService.get(liveKey);
      if (cachedLive) {
        // Log a simulated cache hit in our SQLite statistics table (0 latency, 0 cost)
        CostAnalyser.logApiCall({
          endpoint: `/sites/${siteId}/departures`,
          method: 'GET',
          statusCode: 200,
          latencyMs: 0,
          costUnits: 0,
          status: 'success',
          cacheHit: true
        });

        return reply.status(200).send({
          status: 'success',
          source: 'cache',
          data: cachedLive
        });
      }
    } catch (cacheErr) {
      console.error('Failed to read live cache from Redis, proceeding to API request:', cacheErr);
    }

    // 2. Live Cache Miss: Fetch fresh data from the SL API
    try {
      const freshData = await SlApiService.fetchLiveDepartures(siteId);

      // Write to live cache (15 seconds TTL) and fallback cache (24 hours TTL)
      await CacheService.set(liveKey, freshData, 15);
      await CacheService.set(fallbackKey, freshData, 24 * 60 * 60);

      return reply.status(200).send({
        status: 'success',
        source: 'network',
        data: freshData
      });
    } catch (apiErr) {
      console.warn(`SL External API failure for site ${siteId}. Triggering graceful circuit breaker...`);

      // 3. Graceful Degradation: Search for the 24h fallback cache record
      try {
        const fallbackData = await CacheService.get(fallbackKey);
        
        if (fallbackData) {
          // Log fallback event in database
          CostAnalyser.logApiCall({
            endpoint: `/sites/${siteId}/departures`,
            method: 'GET',
            statusCode: 200, // Return 200 to indicate graceful fallback
            latencyMs: 5,
            costUnits: 0,
            status: 'success',
            cacheHit: true
          });

          return reply.status(200).send({
            status: 'success',
            source: 'cache_fallback',
            data: fallbackData,
            warnings: ['Displaying cached data due to central server downtime.']
          });
        }
      } catch (fallbackErr) {
        console.error('Failed to read fallback cache from Redis:', fallbackErr);
      }

      // 4. Blackout State: Both live API and fallback cache are unavailable
      return reply.status(503).send({
        status: 'error',
        source: 'error',
        message: 'Transit network temporarily unreachable.'
      });
    }
  });
};

export default departuresRoutes;
