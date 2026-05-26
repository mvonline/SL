import { CostAnalyser } from './costAnalyser.js';
import stationsSeed from '../data/stockholmStationsSeed.json' with { type: 'json' };

const STOCKHOLM_STATIONS_SEED: ThinnedStation[] = stationsSeed as ThinnedStation[];

const SL_API_BASE = 'https://transport.integration.sl.se/v1';

/** Greater Stockholm / Mälardalen service area */
const STOCKHOLM_BOUNDS = {
  minLat: 58.85,
  maxLat: 60.05,
  minLon: 17.25,
  maxLon: 19.15,
};

export interface ThinnedStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  tariff_zone: string;
  stop_type: string;
  is_major: number;
}

const MAJOR_NAME_HINTS = [
  'T-Centralen',
  'Slussen',
  'Odenplan',
  'Solna',
  'Liljeholmen',
  'Gullmarsplan',
  'Nybroplan',
  'Farsta',
  'Skärholmen',
  'Märsta',
  'Arlanda',
  'Södertälje',
  'Nynäshamn',
  'Globen',
];

function inStockholmRegion(lat: number, lon: number): boolean {
  return (
    lat >= STOCKHOLM_BOUNDS.minLat &&
    lat <= STOCKHOLM_BOUNDS.maxLat &&
    lon >= STOCKHOLM_BOUNDS.minLon &&
    lon <= STOCKHOLM_BOUNDS.maxLon
  );
}

function mapStopType(item: Record<string, unknown>): string {
  const areaType = String(
    (item.stop_area as { type?: string } | undefined)?.type || item.type || ''
  ).toUpperCase();

  if (areaType.includes('METRO')) return 'METRO';
  if (areaType.includes('RAIL') || areaType.includes('TRAIN')) return 'TRAIN';
  if (areaType.includes('SHIP') || areaType.includes('FERRY')) return 'FERRY';
  if (areaType.includes('BUS') || areaType === 'BUSTERM') return 'BUS';
  // SL sites (journey planner hubs) default to metro, not bus
  return 'METRO';
}

function isMajorName(name: string): number {
  return MAJOR_NAME_HINTS.some((hint) => name.includes(hint)) ? 1 : 0;
}

function normalizeRecord(item: Record<string, unknown>, idPrefix = ''): ThinnedStation | null {
  const lat = Number(item.lat ?? item.latitude);
  const lon = Number(item.lon ?? item.longitude);
  const id = item.id ?? item.siteId;

  if (!id || !Number.isFinite(lat) || !Number.isFinite(lon) || !inStockholmRegion(lat, lon)) {
    return null;
  }

  const name = String(item.name || 'Unknown Stop').trim();
  return {
    id: idPrefix ? `${idPrefix}${id}` : String(id),
    name,
    latitude: lat,
    longitude: lon,
    tariff_zone: String(item.tariffZone || item.tariff_zone || 'A'),
    stop_type: mapStopType(item),
    is_major: isMajorName(name),
  };
}

export const SlApiService = {
  /**
   * Performs an HTTP request to the SL API with strict timeouts and logs metadata.
   */
  async request<T>(endpoint: string, options: RequestInit = {}, timeoutMs = 4000): Promise<T> {
    const url = `${SL_API_BASE}${endpoint}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();
    let statusCode = 200;

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      statusCode = response.status;
      clearTimeout(id);

      if (!response.ok) {
        throw new Error(`HTTP request failed with status: ${response.status}`);
      }

      const latencyMs = Date.now() - startTime;
      const costUnits = CostAnalyser.calculateCost(endpoint);

      CostAnalyser.logApiCall({
        endpoint,
        method: options.method || 'GET',
        statusCode,
        latencyMs,
        costUnits,
        status: 'success',
        cacheHit: false,
      });

      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(id);
      const latencyMs = Date.now() - startTime;
      const costUnits = CostAnalyser.calculateCost(endpoint);
      const error = err as { name?: string };
      const resolvedStatus = error.name === 'AbortError' ? 408 : statusCode || 500;

      CostAnalyser.logApiCall({
        endpoint,
        method: options.method || 'GET',
        statusCode: resolvedStatus,
        latencyMs,
        costUnits,
        status: 'failure',
        cacheHit: false,
      });

      throw err;
    }
  },

  /**
   * Fetches SL sites + stop-points across greater Stockholm.
   * Falls back to a wide static seed if the API is slow or unreachable.
   */
  async fetchAndThinStations(): Promise<ThinnedStation[]> {
    try {
      console.log('Fetching SL sites and stop-points (greater Stockholm)...');

      const sites = await this.request<unknown[]>('/sites?expand=true', {}, 90_000);

      let merged: ThinnedStation[] = [];
      const seen = new Set<string>();

      const add = (station: ThinnedStation | null, allowBus = false) => {
        if (!station || seen.has(station.id)) return;
        if (!allowBus && station.stop_type === 'BUS') return;
        seen.add(station.id);
        merged.push(station);
      };

      if (Array.isArray(sites)) {
        console.log(`Processing ${sites.length} SL sites...`);
        for (const site of sites) {
          add(normalizeRecord(site as Record<string, unknown>));
        }
      }

      // Stop-points add suburban/rural bus & rail quays across the county
      try {
        const stopPoints = await this.request<unknown[]>('/stop-points', {}, 120_000);
        if (Array.isArray(stopPoints)) {
          console.log(`Processing ${stopPoints.length} SL stop-points...`);
          for (const point of stopPoints) {
            const record = normalizeRecord(point as Record<string, unknown>, 'sp-');
            // Only rail quays from stop-points — bus quays are too numerous for the map
            if (record && (record.stop_type === 'METRO' || record.stop_type === 'TRAIN')) {
              add(record);
            }
          }
        }
      } catch (stopErr) {
        console.warn('Stop-points fetch skipped or failed; using sites only.', stopErr);
      }

      if (merged.length < 20) {
        throw new Error(`Too few stations parsed from SL API (${merged.length}).`);
      }

      console.log(`SL API returned ${merged.length} stations in greater Stockholm.`);
      return merged;
    } catch (err) {
      console.warn(
        'SL API unavailable or incomplete. Using expanded greater-Stockholm static seed.',
        err
      );
      return STOCKHOLM_STATIONS_SEED.map((s: ThinnedStation) => ({ ...s }));
    }
  },

  /**
   * Fetches real-time departures.
   * If network is down, resolves with mock departures to feed our fallback cache.
   */
  async fetchLiveDepartures(siteId: string): Promise<unknown> {
    try {
      return await this.request<unknown>(`/sites/${siteId}/departures`);
    } catch (err) {
      console.warn(`SL Live API Departures failed for site: ${siteId}. Using mock stream.`, err);

      const station =
        STOCKHOLM_STATIONS_SEED.find(
          (s: ThinnedStation) => s.id === siteId || siteId.endsWith(s.id)
        ) || {
          name: 'Stockholm Stop',
          stop_type: 'METRO',
        };

      return {
        siteId,
        name: station.name,
        timestamp: new Date().toISOString(),
        departures: [
          {
            line: station.stop_type === 'METRO' ? 'T14' : station.stop_type === 'TRAIN' ? 'J40' : '4',
            destination: 'Mörby centrum',
            display: '2 min',
            expected: new Date(Date.now() + 120_000).toISOString(),
            stopType: station.stop_type,
          },
          {
            line: station.stop_type === 'METRO' ? 'T13' : station.stop_type === 'TRAIN' ? 'J41' : '3',
            destination: 'Norsborg',
            display: '7 min',
            expected: new Date(Date.now() + 420_000).toISOString(),
            stopType: station.stop_type,
          },
          {
            line: station.stop_type === 'METRO' ? 'T14' : station.stop_type === 'TRAIN' ? 'J40' : '4',
            destination: 'Fruängen',
            display: '11 min',
            expected: new Date(Date.now() + 660_000).toISOString(),
            stopType: station.stop_type,
          },
        ],
      };
    }
  },
};
