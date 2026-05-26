import type { Station } from '../types/index.js';
import { getClosestStation, loadStationsDb } from './stationsDb.js';
import { planTransitTrip, type TransitRouteLeg, type TransitRouteInstruction } from './journeyPlanner.js';

function withDoorWalk(
  route: { legs: TransitRouteLeg[]; instructions: TransitRouteInstruction[] },
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  startStation: Station
) {
  const legs = [...route.legs];
  const instructions = [...route.instructions];
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const firstPoint = firstLeg?.geometry[0];
  const lastPoint = lastLeg?.geometry[lastLeg.geometry.length - 1];

  if (firstPoint) {
    const walkDist = (startLat - firstPoint[0]) ** 2 + (startLon - firstPoint[1]) ** 2;
    if (walkDist > 0.000001) {
      legs.unshift({
        type: 'walking',
        line: 'Walk',
        color: '#9CA3AF',
        style: 'dotted',
        geometry: [[startLat, startLon], firstPoint],
      });
      instructions.unshift({
        kind: 'walk',
        line: 'Walk',
        text: `Walk to ${startStation.name}`,
        durationMin: 2,
      });
    }
  }

  if (lastPoint) {
    const walkDist = (endLat - lastPoint[0]) ** 2 + (endLon - lastPoint[1]) ** 2;
    if (walkDist > 0.000001) {
      legs.push({
        type: 'walking',
        line: 'Walk',
        color: '#9CA3AF',
        style: 'dotted',
        geometry: [[lastPoint[0], lastPoint[1]], [endLat, endLon]],
      });
      instructions.push({
        kind: 'walk',
        line: 'Walk',
        text: 'Walk to destination',
        durationMin: 2,
      });
    }
  }

  return { legs, instructions };
}

export async function getRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  mode: 'walking' | 'driving' | 'transit',
  fromName?: string,
  toName?: string
) {
  if (mode === 'walking' || mode === 'driving') {
    const osrmProfile = mode === 'walking' ? 'foot' : 'car';
    const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;

    try {
      const response = await fetch(osrmUrl);
      if (!response.ok) throw new Error('OSRM error');
      const data = (await response.json()) as {
        routes?: {
          duration: number;
          distance: number;
          geometry: { coordinates: [number, number][] };
          legs: { steps?: { maneuver: { instruction: string }; distance: number }[] }[];
        }[];
      };
      if (!data.routes?.length) throw new Error('No route');
      const route = data.routes[0];
      const coordinates = route.geometry.coordinates.map(
        (coord) => [coord[1], coord[0]] as [number, number]
      );
      return {
        mode,
        durationSec: route.duration,
        distanceMeters: route.distance,
        geometry: coordinates,
        instructions: [
          { text: 'Start', distance: 0 },
          ...(route.legs[0].steps?.map((step) => ({
            text: step.maneuver.instruction,
            distance: step.distance,
          })) ?? [{ text: 'Proceed to destination', distance: route.distance }]),
        ],
      };
    } catch {
      return {
        mode,
        durationSec: 300,
        distanceMeters: 1000,
        geometry: [
          [fromLat, fromLon],
          [toLat, toLon],
        ],
        instructions: [{ text: 'Direct path (routing service unavailable)', distance: 1000 }],
      };
    }
  }

  const stations = await loadStationsDb();
  if (stations.length === 0) {
    throw new Error('Offline station database is empty.');
  }

  const startStation = getClosestStation(stations, fromLat, fromLon);
  const endStation = getClosestStation(stations, toLat, toLon);

  const route = await planTransitTrip({
    fromLat,
    fromLon,
    toLat,
    toLon,
    fromName: fromName || startStation.name,
    toName: toName || endStation.name,
    fromStationId: startStation.id,
    toStationId: endStation.id,
  });

  const { legs, instructions } = withDoorWalk(
    route,
    fromLat,
    fromLon,
    toLat,
    toLon,
    startStation
  );

  return {
    mode: 'transit' as const,
    totalDurationMin: route.totalDurationMin,
    interchanges: route.interchanges,
    legs,
    instructions,
  };
}
