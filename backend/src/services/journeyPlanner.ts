import { CostAnalyser } from './costAnalyser.js';

const JP_BASE = 'https://journeyplanner.integration.sl.se/v2';

export interface TransitRouteLeg {
  type: 'walking' | 'transit';
  line: string;
  color: string;
  style: 'solid' | 'dotted';
  geometry: [number, number][];
  vehicle?: TransitVehicleType;
}

export type TransitVehicleType =
  | 'WALK'
  | 'METRO'
  | 'TRAIN'
  | 'BUS'
  | 'FERRY'
  | 'TRAM'
  | 'TRANSFER';

export interface TransitRouteInstruction {
  text: string;
  durationMin?: number;
  line?: string;
  kind?: 'walk' | 'board' | 'ride' | 'transfer' | 'arrive';
  vehicle?: TransitVehicleType;
  color?: string;
}

export interface TransitRouteResult {
  totalDurationMin: number;
  interchanges: number;
  legs: TransitRouteLeg[];
  instructions: TransitRouteInstruction[];
}

interface JpLocation {
  id: string;
  name: string;
  disassembledName?: string;
  coord?: [number, number];
  isBest?: boolean;
}

interface JpLeg {
  duration?: number;
  transportation?: {
    disassembledName?: string;
    name?: string;
    number?: string;
    destination?: { name?: string };
    product?: { class?: number; name?: string };
  };
  origin?: { disassembledName?: string; name?: string; parent?: { disassembledName?: string; name?: string } };
  destination?: {
    disassembledName?: string;
    name?: string;
    parent?: { disassembledName?: string; name?: string };
  };
  coords?: [number, number][];
}

interface JpJourney {
  tripRtDuration?: number;
  tripDuration?: number;
  interchanges?: number;
  legs?: JpLeg[];
}

/** Base hue per mode; extra shades when the same mode appears more than once (e.g. two buses) */
const VEHICLE_SHADES: Record<TransitVehicleType, string[]> = {
  WALK: ['#9CA3AF'],
  METRO: ['#EF4444', '#DC2626', '#F87171', '#B91C1C'],
  TRAIN: ['#EC4899', '#DB2777', '#F472B6', '#BE185D'],
  BUS: ['#06B6D4', '#0891B2', '#22D3EE', '#0E7490'],
  FERRY: ['#3B82F6', '#2563EB', '#60A5FA', '#1D4ED8'],
  TRAM: ['#10B981', '#059669', '#34D399', '#047857'],
  TRANSFER: ['#F59E0B'],
};

function colorForVehicle(vehicle: TransitVehicleType, sameModeIndex: number): string {
  const shades = VEHICLE_SHADES[vehicle] ?? VEHICLE_SHADES.TRAIN;
  return shades[sameModeIndex % shades.length];
}

function stopLabel(point?: JpLeg['origin']): string {
  if (!point) return 'stop';
  return (
    point.parent?.disassembledName ||
    point.parent?.name ||
    point.disassembledName ||
    point.name ||
    'stop'
  );
}

/** SL journey planner global id from short site id (e.g. 9704 → 9091001000009704) */
export function toSlGlobalId(stationId: string): string | null {
  if (stationId.startsWith('sp-')) return null;
  const raw = stationId.replace(/^sp-/, '');
  if (!/^\d+$/.test(raw) || raw.length > 8) return null;
  return `90910010000${raw.padStart(5, '0')}`;
}

/** Short SL site id from journey planner global id (e.g. 9091001000009704 → 9704) */
export function globalIdToSiteId(globalId: string): string | null {
  const m = globalId.match(/^90910010000(\d+)$/);
  if (!m) return null;
  return String(parseInt(m[1], 10));
}

function distanceSq(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return (lat1 - lat2) ** 2 + (lon1 - lon2) ** 2;
}

async function jpFetch<T>(path: string, timeoutMs = 45_000): Promise<T> {
  const url = `${JP_BASE}${path}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    const data = (await res.json()) as T;

    CostAnalyser.logApiCall({
      endpoint: path.split('?')[0],
      method: 'GET',
      statusCode: res.ok ? 200 : res.status,
      latencyMs: Date.now() - start,
      costUnits: 5,
      status: res.ok ? 'success' : 'failure',
      cacheHit: false,
    });

    if (!res.ok) throw new Error(`Journey planner HTTP ${res.status}`);
    return data;
  } catch (err) {
    clearTimeout(id);
    CostAnalyser.logApiCall({
      endpoint: path.split('?')[0],
      method: 'GET',
      statusCode: 408,
      latencyMs: Date.now() - start,
      costUnits: 5,
      status: 'failure',
      cacheHit: false,
    });
    throw err;
  }
}

export async function findStopGlobalId(
  name: string,
  lat: number,
  lon: number
): Promise<string | null> {
  const searchName = name.split('(')[0].trim();
  const data = await jpFetch<{ locations?: JpLocation[] }>(
    `/stop-finder?name_sf=${encodeURIComponent(searchName)}&any_obj_filter_sf=2&type_sf=any`
  );

  const locations = data.locations ?? [];
  if (locations.length === 0) return null;

  const withCoord = locations.filter((l) => l.coord?.length === 2);
  if (withCoord.length > 0) {
    const closest = withCoord.reduce((best, loc) => {
      const [la, lo] = loc.coord!;
      const d = distanceSq(lat, lon, la, lo);
      const dBest = distanceSq(lat, lon, best.coord![0], best.coord![1]);
      return d < dBest ? loc : best;
    });
    return closest.id;
  }

  const best = locations.find((l) => l.isBest) ?? locations[0];
  return best.id;
}

/** Resolve any station id (including sp- stop-points) to SL departures site id */
export async function resolveDeparturesSiteId(
  stationId: string,
  station?: { name: string; latitude: number; longitude: number }
): Promise<string | null> {
  if (!stationId.startsWith('sp-') && /^\d+$/.test(stationId)) {
    return stationId;
  }

  if (!station?.name) return null;

  const globalId = await findStopGlobalId(station.name, station.latitude, station.longitude);
  if (!globalId) return null;
  return globalIdToSiteId(globalId);
}

function isWalkingLeg(leg: JpLeg): boolean {
  const cls = leg.transportation?.product?.class;
  const productName = (leg.transportation?.product?.name || '').toLowerCase();
  return cls === 99 || productName.includes('foot') || productName.includes('walk');
}

function vehicleTypeFromLeg(leg: JpLeg): TransitVehicleType {
  if (isWalkingLeg(leg)) return 'WALK';
  const productName = (leg.transportation?.product?.name || '').toLowerCase();
  if (productName.includes('tunnelbana') || productName.includes('metro')) return 'METRO';
  if (productName.includes('tåg') || productName.includes('train') || productName.includes('pendel'))
    return 'TRAIN';
  if (productName.includes('buss') || productName.includes('bus')) return 'BUS';
  if (productName.includes('ferry') || productName.includes('båt')) return 'FERRY';
  if (productName.includes('tram') || productName.includes('spårvagn')) return 'TRAM';
  return 'TRAIN';
}


function lineLabel(leg: JpLeg): string {
  if (isWalkingLeg(leg)) return 'Walk';
  const t = leg.transportation;
  const product = t?.product?.name || '';
  const number = t?.number?.trim();
  const disassembled = t?.disassembledName?.trim();
  const lineDisplay = String(
    (t?.properties as { lineDisplay?: string } | undefined)?.lineDisplay || ''
  ).toUpperCase();

  // ITP = internal SL/HACON line-display code, not a real line name — prefer number/product
  let line: string;
  if (lineDisplay === 'ITP' || disassembled?.toUpperCase() === 'ITP') {
    line = number || product || 'Transit';
  } else {
    line = disassembled || number || t?.name || 'Transit';
  }

  const dest = t?.destination?.name;
  if (dest) return `${line} → ${dest}`;
  if (product && !line.includes(product)) return `${line} (${product})`;
  return line;
}

function mapCoords(coords?: [number, number][]): [number, number][] {
  if (!coords?.length) return [];
  return coords.map(([lat, lon]) => [lat, lon] as [number, number]);
}

function parseJourney(journey: JpJourney): TransitRouteResult {
  const legs: TransitRouteLeg[] = [];
  const instructions: TransitRouteInstruction[] = [];
  const jpLegs = journey.legs ?? [];
  const modeCounts: Partial<Record<TransitVehicleType, number>> = {};

  jpLegs.forEach((leg, index) => {
    const walking = isWalkingLeg(leg);
    const from = stopLabel(leg.origin);
    const to = stopLabel(leg.destination);
    const line = lineLabel(leg);
    const durationMin = leg.duration ? Math.max(1, Math.round(leg.duration / 60)) : undefined;
    const geometry = mapCoords(leg.coords);

    const vehicle: TransitVehicleType = walking ? 'WALK' : vehicleTypeFromLeg(leg);
    const modeIndex = modeCounts[vehicle] ?? 0;
    const color = colorForVehicle(vehicle, modeIndex);
    if (!walking) modeCounts[vehicle] = modeIndex + 1;

    if (geometry.length === 0 && leg.origin?.coord && leg.destination?.coord) {
      geometry.push([leg.origin.coord[0], leg.origin.coord[1]]);
      geometry.push([leg.destination.coord[0], leg.destination.coord[1]]);
    }

    legs.push({
      type: walking ? 'walking' : 'transit',
      line,
      color,
      style: walking ? 'dotted' : 'solid',
      geometry,
      vehicle,
    });

    if (walking) {
      instructions.push({
        kind: 'walk',
        line: 'Walk',
        vehicle: 'WALK',
        color,
        text: `Walk to ${to} (${durationMin ?? '?'} min)`,
        durationMin,
      });
    } else {
      const prev = jpLegs[index - 1];
      if (index > 0 && prev && !isWalkingLeg(prev)) {
        instructions.push({
          kind: 'transfer',
          line: 'Change',
          vehicle: 'TRANSFER',
          color: colorForVehicle('TRANSFER', 0),
          text: `Change at ${from} — switch lines`,
        });
      }
      const destHeadsign = leg.transportation?.destination?.name;
      instructions.push({
        kind: 'board',
        line,
        vehicle,
        color,
        text: destHeadsign
          ? `Take ${line} towards ${destHeadsign}`
          : `Take ${line} from ${from}`,
        durationMin,
      });
      instructions.push({
        kind: 'arrive',
        line,
        vehicle,
        color,
        text: `Get off at ${to}`,
      });
    }
  });

  const totalDurationMin = Math.max(
    1,
    Math.round((journey.tripRtDuration ?? journey.tripDuration ?? 0) / 60)
  );

  return {
    totalDurationMin,
    interchanges: journey.interchanges ?? 0,
    legs,
    instructions,
  };
}

export async function planTransitTrip(options: {
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  fromName?: string;
  toName?: string;
  fromStationId?: string;
  toStationId?: string;
}): Promise<TransitRouteResult> {
  let originId: string | null = null;
  let destId: string | null = null;

  if (options.fromName) {
    originId = await findStopGlobalId(options.fromName, options.fromLat, options.fromLon);
  }
  if (!originId && options.fromStationId) {
    originId = toSlGlobalId(options.fromStationId);
  }

  if (options.toName) {
    destId = await findStopGlobalId(options.toName, options.toLat, options.toLon);
  }
  if (!destId && options.toStationId) {
    destId = toSlGlobalId(options.toStationId);
  }

  if (!originId || !destId) {
    throw new Error('Could not resolve origin or destination stops for journey planning.');
  }

  const data = await jpFetch<{ journeys?: JpJourney[]; systemMessages?: { type: string; text: string }[] }>(
    `/trips?type_origin=any&type_destination=any&name_origin=${encodeURIComponent(originId)}&name_destination=${encodeURIComponent(destId)}&calc_number_of_trips=3`
  );

  const journeys = data.journeys ?? [];
  if (journeys.length === 0) {
    const errMsg = data.systemMessages?.map((m) => m.text).filter(Boolean).join('; ');
    throw new Error(errMsg || 'No transit journeys found between these stops.');
  }

  return parseJourney(journeys[0]);
}
