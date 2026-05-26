import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { SeedingCronService } from '../services/cron.js';
import { CostAnalyser } from '../services/costAnalyser.js';

interface AdminStatsQuery {
  days?: string;
}

const adminRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. On-Demand Seeding Sync Trigger
  fastify.post('/sync', async (request, reply) => {
    try {
      console.log('Admin triggered on-demand station seeding sync...');
      const result = await SeedingCronService.synchronizeStations();

      if (result.success) {
        return reply.status(200).send({
          status: 'success',
          message: `On-demand synchronization complete. Successfully seeded/updated ${result.count} stations.`,
          count: result.count
        });
      } else {
        return reply.status(500).send({
          status: 'error',
          message: 'Synchronization failed during processing.',
          error: result.error
        });
      }
    } catch (err: any) {
      return reply.status(500).send({
        status: 'error',
        message: 'On-demand sync failed.',
        error: err.message
      });
    }
  });

  // 2. Cost Analyser Dashboard Stats Retrieve
  fastify.get('/stats', async (request, reply) => {
    const { days } = request.query as AdminStatsQuery;
    const daysRange = days ? parseInt(days, 10) : 7;

    try {
      const analytics = CostAnalyser.getStats(daysRange);
      return reply.status(200).send({
        status: 'success',
        timeframeDays: daysRange,
        data: analytics
      });
    } catch (err: any) {
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to retrieve Cost Analyser statistics.',
        error: err.message
      });
    }
  });
};

export default adminRoutes;
