import cron from 'node-cron';
import { SlApiService } from './slApi.js';
import { db } from '../db/connection.js';

export const SeedingCronService = {
  /**
   * Performs the actual synchronization of static stations.
   * Feeds the SL sites into our SQLite thinned schema, supporting UPSERT.
   */
  async synchronizeStations(): Promise<{ success: boolean; count: number; error?: string }> {
    console.log('Static Station Synchronization started...');
    const startTime = Date.now();
    
    try {
      const thinnedStations = await SlApiService.fetchAndThinStations();
      console.log(`Fetched ${thinnedStations.length} thinned stations, seeding to database...`);

      // Using SQLite transaction for atomic and high-speed multi-row insertion
      const insertTransaction = db.transaction((stations) => {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO stations (id, name, latitude, longitude, tariff_zone, stop_type, is_major)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const station of stations) {
          stmt.run(
            station.id,
            station.name,
            station.latitude,
            station.longitude,
            station.tariff_zone,
            station.stop_type,
            station.is_major
          );
        }
      });

      insertTransaction(thinnedStations);

      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`Synchronization succeeded! Loaded ${thinnedStations.length} stations in ${durationSec}s.`);

      return {
        success: true,
        count: thinnedStations.length
      };
    } catch (err: any) {
      console.error('Error during static station synchronization:', err);
      return {
        success: false,
        count: 0,
        error: err.message
      };
    }
  },

  /**
   * Initializes background cron schedules.
   */
  initialize(): void {
    // Schedule static seeder to sync every night at midnight (00:00)
    cron.schedule('0 0 * * *', async () => {
      console.log('Daily midnight sync cron triggered...');
      await this.synchronizeStations();
    });

    console.log('Daily midnight Seeding Cron scheduled successfully.');
    
    // Proactively run an initial seeding task asynchronously when the service starts
    // to ensure the SQLite volume is not empty on fresh Docker deployment.
    setTimeout(async () => {
      console.log('Triggering initial container startup seeding check...');
      
      const rowCount = db.prepare('SELECT COUNT(*) as count FROM stations').get() as { count: number };
      // Re-sync if empty or still on old small central-only seed (~50 stops)
      if (rowCount.count === 0 || rowCount.count < 60) {
        console.log(
          `Stations table has ${rowCount.count} rows — syncing full greater-Stockholm dataset...`
        );
        await this.synchronizeStations();
      } else {
        console.log(`Database already seeded with ${rowCount.count} stations. Skipping initial sync.`);
      }
    }, 2000);
  }
};
