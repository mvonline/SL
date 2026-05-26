import type { RouteInstruction, RouteLeg, RouteVehicleType } from '../types/index.js';

/** Shades per vehicle — same family, different tone for each leg of that mode */
export const VEHICLE_SHADES: Record<RouteVehicleType, string[]> = {
  WALK: ['#9CA3AF'],
  METRO: ['#EF4444', '#DC2626', '#F87171', '#B91C1C'],
  TRAIN: ['#EC4899', '#DB2777', '#F472B6', '#BE185D'],
  BUS: ['#06B6D4', '#0891B2', '#22D3EE', '#0E7490'],
  FERRY: ['#3B82F6', '#2563EB', '#60A5FA', '#1D4ED8'],
  TRAM: ['#10B981', '#059669', '#34D399', '#047857'],
  TRANSFER: ['#F59E0B'],
};

export function colorForVehicle(vehicle: RouteVehicleType, sameModeIndex: number): string {
  const shades = VEHICLE_SHADES[vehicle] ?? VEHICLE_SHADES.TRAIN;
  return shades[sameModeIndex % shades.length];
}

export function assignVehicleLegColors(legs: RouteLeg[]): RouteLeg[] {
  const modeCounts: Partial<Record<RouteVehicleType, number>> = {};

  return legs.map((leg) => {
    if (leg.type === 'walking') {
      return {
        ...leg,
        vehicle: 'WALK',
        color: colorForVehicle('WALK', 0),
        style: 'dotted',
      };
    }
    const vehicle = leg.vehicle ?? 'TRAIN';
    const modeIndex = modeCounts[vehicle] ?? 0;
    modeCounts[vehicle] = modeIndex + 1;
    return {
      ...leg,
      vehicle,
      color: colorForVehicle(vehicle, modeIndex),
      style: 'solid',
    };
  });
}

export function syncInstructionColors(
  instructions: RouteInstruction[],
  legs: RouteLeg[]
): RouteInstruction[] {
  const legByLine = new Map<string, RouteLeg>();
  legs.forEach((l) => {
    if (l.type === 'transit') legByLine.set(l.line, l);
  });

  const modeCounts: Partial<Record<RouteVehicleType, number>> = {};

  return instructions.map((step) => {
    if (step.kind === 'walk') {
      return { ...step, vehicle: 'WALK', color: colorForVehicle('WALK', 0) };
    }
    if (step.kind === 'transfer') {
      return { ...step, vehicle: 'TRANSFER', color: colorForVehicle('TRANSFER', 0) };
    }

    const vehicle = step.vehicle ?? 'TRAIN';
    const matchedLeg = step.line ? legByLine.get(step.line) : undefined;
    if (matchedLeg?.color) {
      return { ...step, vehicle, color: matchedLeg.color };
    }

    if (step.kind === 'board') {
      const idx = modeCounts[vehicle] ?? 0;
      return { ...step, vehicle, color: colorForVehicle(vehicle, idx) };
    }
    if (step.kind === 'arrive') {
      const idx = modeCounts[vehicle] ?? 0;
      modeCounts[vehicle] = idx + 1;
      return { ...step, vehicle, color: colorForVehicle(vehicle, idx) };
    }
    return step;
  });
}
