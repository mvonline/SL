import { db } from '../db/connection.js';
import { logger } from './logger.js';

export interface ApiCallMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  costUnits: number;
  status: 'success' | 'failure';
  cacheHit: boolean;
}

// Cost allocation rules mapping endpoint substrings to cost units
const COST_RULES: { [key: string]: number } = {
  '/departures': 1,      // Moderate cost for live polls
  '/routing': 5,         // High cost for pathway computations
  '/sites': 10,          // Very high cost for heavy bulk syncing
  '/stop-points': 10,
};

export const CostAnalyser = {
  /**
   * Determine the credit cost of a request based on endpoint keywords.
   */
  calculateCost(url: string): number {
    for (const [key, cost] of Object.entries(COST_RULES)) {
      if (url.includes(key)) {
        return cost;
      }
    }
    return 1; // Default fallback cost
  },

  /**
   * Logs a transit external API communication both to the daily rotated log file and SQLite.
   */
  logApiCall(metric: ApiCallMetric): void {
    const timestamp = new Date().toISOString();

    // 1. Write to the winston daily rotated file
    logger.info({
      timestamp,
      ...metric,
    });

    // 2. Insert into SQLite for local cost analysis
    try {
      db.prepare(`
        INSERT INTO api_logs (endpoint, method, status_code, latency_ms, cost_units, status, cache_hit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        metric.endpoint,
        metric.method,
        metric.statusCode,
        metric.latencyMs,
        metric.costUnits,
        metric.status,
        metric.cacheHit ? 1 : 0
      );
    } catch (err) {
      console.error('Failed to log API call in SQLite database:', err);
    }
  },

  /**
   * Query database to pull detailed cost and rate statistics for the admin dashboard.
   */
  getStats(days: number = 7) {
    const statsQuery = db.prepare(`
      SELECT 
        COUNT(*) as total_calls,
        SUM(cost_units) as total_cost,
        AVG(latency_ms) as avg_latency_ms,
        SUM(CASE WHEN status_code = 200 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate_percent,
        SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) as total_cache_hits
      FROM api_logs
      WHERE timestamp >= datetime('now', ?)
    `);

    const statusCodesQuery = db.prepare(`
      SELECT status_code, COUNT(*) as count
      FROM api_logs
      WHERE timestamp >= datetime('now', ?)
      GROUP BY status_code
    `);

    const dailyUsageQuery = db.prepare(`
      SELECT strftime('%Y-%m-%d', timestamp) as date, COUNT(*) as count, SUM(cost_units) as cost
      FROM api_logs
      WHERE timestamp >= datetime('now', ?)
      GROUP BY date
      ORDER BY date ASC
    `);

    const timeWindow = `-${days} days`;

    try {
      const general = statsQuery.get(timeWindow) as {
        total_calls: number;
        total_cost: number;
        avg_latency_ms: number | null;
        success_rate_percent: number | null;
        total_cache_hits: number;
      };

      const codes = statusCodesQuery.all(timeWindow) as { status_code: number; count: number }[];
      const daily = dailyUsageQuery.all(timeWindow) as { date: string; count: number; cost: number }[];

      return {
        totalCalls: general?.total_calls || 0,
        totalCostCredits: general?.total_cost || 0,
        averageLatencyMs: general?.avg_latency_ms ? Math.round(general.avg_latency_ms) : 0,
        successRatePercentage: general?.success_rate_percent ? parseFloat(general.success_rate_percent.toFixed(2)) : 100,
        cacheHits: general?.total_cache_hits || 0,
        statusCodeDistribution: codes.reduce((acc, current) => {
          acc[current.status_code] = current.count;
          return acc;
        }, {} as { [key: number]: number }),
        dailyTimeline: daily,
      };
    } catch (err) {
      console.error('Failed to query api analysis stats:', err);
      return {
        totalCalls: 0,
        totalCostCredits: 0,
        averageLatencyMs: 0,
        successRatePercentage: 0,
        cacheHits: 0,
        statusCodeDistribution: {},
        dailyTimeline: [],
      };
    }
  }
};
