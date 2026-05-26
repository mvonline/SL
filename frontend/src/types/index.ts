export interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  tariff_zone: string;
  stop_type: 'METRO' | 'TRAIN' | 'BUS' | 'FERRY';
  is_major: number;
}

export interface Departure {
  line: string;
  destination: string;
  display: string;
  expected: string;
  stopType: string;
}

export interface DeparturesResponse {
  siteId: string;
  name: string;
  timestamp: string;
  departures: Departure[];
}

export interface RouteLeg {
  type: 'walking' | 'transit';
  line: string;
  color: string;
  style: 'solid' | 'dotted';
  geometry: [number, number][];
}

export interface RouteInstruction {
  text: string;
  durationMin?: number;
  distance?: number;
  line?: string;
  kind?: 'walk' | 'board' | 'ride' | 'transfer' | 'arrive';
}

export interface RouteResponse {
  status: 'success' | 'error';
  mode: 'walking' | 'driving' | 'transit';
  totalDurationMin?: number;
  interchanges?: number;
  durationSec?: number;
  distanceMeters?: number;
  geometry?: [number, number][];
  legs?: RouteLeg[];
  instructions: RouteInstruction[];
}

export interface CostStats {
  totalCalls: number;
  totalCostCredits: number;
  averageLatencyMs: number;
  successRatePercentage: number;
  cacheHits: number;
  statusCodeDistribution: { [key: number]: number };
  dailyTimeline: { date: string; count: number; cost: number }[];
}

export interface AuthState {
  token: string | null;
  username: string | null;
}
