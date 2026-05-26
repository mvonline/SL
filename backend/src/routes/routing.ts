import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { db } from '../db/connection.js';
import { CostAnalyser } from '../services/costAnalyser.js';
import { planTransitTrip } from '../services/journeyPlanner.js';

interface RoutingQuery {
  fromLat?: string;
  fromLon?: string;
  toLat?: string;
  toLon?: string;
  fromName?: string;
  toName?: string;
  mode?: 'walking' | 'driving' | 'transit';
}

interface StationRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  stop_type: string;
}

function getClosestStation(stations: StationRow[], lat: number, lon: number): StationRow {
  return stations.reduce((closest, curr) => {
    const dClosest = (closest.latitude - lat) ** 2 + (closest.longitude - lon) ** 2;
    const dCurr = (curr.latitude - lat) ** 2 + (curr.longitude - lon) ** 2;
    return dCurr < dClosest ? curr : closest;
  });
}

const routingRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/', async (request, reply) => {
    const { fromLat, fromLon, toLat, toLon, fromName, toName, mode = 'transit' } =
      request.query as RoutingQuery;

    if (!fromLat || !fromLon || !toLat || !toLon) {
      return reply.status(400).send({
        status: 'error',
        message: 'Coordinates (fromLat, fromLon, toLat, toLon) are required.',
      });
    }

    const startLat = parseFloat(fromLat);
    const startLon = parseFloat(fromLon);
    const endLat = parseFloat(toLat);
    const endLon = parseFloat(toLon);
    const startTime = Date.now();

    if (mode === 'walking' || mode === 'driving') {
      const osrmProfile = mode === 'walking' ? 'foot' : 'car';
      const osrmUrl = `http://router.project-osrm.org/route/v1/${osrmProfile}/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;

      try {
        const response = await fetch(osrmUrl);
        if (!response.ok) throw new Error('OSRM central server error.');
        const data = (await response.json()) as {
          routes?: { duration: number; distance: number; geometry: { coordinates: [number, number][] }; legs: { steps?: { maneuver: { instruction: string }; distance: number }[] }[] }[];
        };

        if (!data.routes?.length) throw new Error('No route geometries found.');

        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(
          (coord) => [coord[1], coord[0]] as [number, number]
        );

        CostAnalyser.logApiCall({
          endpoint: `/routing/${mode}`,
          method: 'GET',
          statusCode: 200,
          latencyMs: Date.now() - startTime,
          costUnits: 5,
          status: 'success',
          cacheHit: false,
        });

        return reply.status(200).send({
          status: 'success',
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
        });
      } catch (err) {
        console.error('OSRM fetch failed, using straight-line fallback:', err);
        return reply.status(200).send({
          status: 'success',
          mode,
          durationSec: 300,
          distanceMeters: 1000,
          geometry: [
            [startLat, startLon],
            [endLat, endLon],
          ],
          instructions: [{ text: 'Direct path (routing service unavailable)', distance: 1000 }],
        });
      }
    }

    // Transit — SL Journey Planner v2 (real lines, transfers, walking legs)
    try {
      const stations = db
        .prepare('SELECT id, name, latitude, longitude, stop_type FROM stations')
        .all() as StationRow[];

      if (stations.length === 0) {
        throw new Error('No stations in database. Run admin sync first.');
      }

      const startStation = getClosestStation(stations, startLat, startLon);
      const endStation = getClosestStation(stations, endLat, endLon);

      const route = await planTransitTrip({
        fromLat: startLat,
        fromLon: startLon,
        toLat: endLat,
        toLon: endLon,
        fromName: fromName || startStation.name,
        toName: toName || endStation.name,
        fromStationId: startStation.id,
        toStationId: endStation.id,
      });

      // First/last walk from exact pin to stop (if planner does not include door-to-door)
      const legs = [...route.legs];
      const instructions = [...route.instructions];

      const firstLeg = legs[0];
      const lastLeg = legs[legs.length - 1];
      const firstPoint = firstLeg?.geometry[0];
      const lastPoint = lastLeg?.geometry[lastLeg.geometry.length - 1];

      if (firstPoint) {
        const walkDist =
          (startLat - firstPoint[0]) ** 2 + (startLon - firstPoint[1]) ** 2;
        if (walkDist > 0.000001) {
          legs.unshift({
            type: 'walking',
            line: 'Walk',
            color: '#9CA3AF',
            style: 'dotted',
            geometry: [
              [startLat, startLon],
              firstPoint,
            ],
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
            geometry: [
              [lastPoint[0], lastPoint[1]],
              [endLat, endLon],
            ],
          });
          instructions.push({
            kind: 'walk',
            line: 'Walk',
            text: 'Walk to destination',
            durationMin: 2,
          });
        }
      }

      CostAnalyser.logApiCall({
        endpoint: '/routing/transit',
        method: 'GET',
        statusCode: 200,
        latencyMs: Date.now() - startTime,
        costUnits: 5,
        status: 'success',
        cacheHit: false,
      });

      return reply.status(200).send({
        status: 'success',
        mode: 'transit',
        totalDurationMin: route.totalDurationMin,
        interchanges: route.interchanges,
        legs,
        instructions,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transit routing failed';
      console.error('Transit routing error:', err);
      return reply.status(500).send({
        status: 'error',
        message,
        error: message,
      });
    }
  });
};

export default routingRoutes;
