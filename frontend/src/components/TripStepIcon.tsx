import type { ReactNode } from 'react';
import { ArrowLeftRight, Bus, Footprints, Ship, Train } from 'lucide-react';
import type { RouteVehicleType } from '../types/index.js';

export const VEHICLE_LABELS: Record<RouteVehicleType, string> = {
  WALK: 'Walk',
  METRO: 'Metro',
  TRAIN: 'Train',
  BUS: 'Bus',
  FERRY: 'Ferry',
  TRAM: 'Tram',
  TRANSFER: 'Change',
};

const DEFAULT_COLORS: Record<RouteVehicleType, string> = {
  WALK: '#9CA3AF',
  METRO: '#EF4444',
  TRAIN: '#EC4899',
  BUS: '#06B6D4',
  FERRY: '#3B82F6',
  TRAM: '#10B981',
  TRANSFER: '#F59E0B',
};

interface TripStepIconProps {
  vehicle?: RouteVehicleType;
  color?: string;
}

export function TripStepIcon({ vehicle = 'TRAIN', color }: TripStepIconProps) {
  const bg = color || DEFAULT_COLORS[vehicle];
  const label = VEHICLE_LABELS[vehicle];

  const iconClass = 'w-3.5 h-3.5 text-white';

  let icon: ReactNode;
  switch (vehicle) {
    case 'WALK':
      icon = <Footprints className={iconClass} aria-hidden />;
      break;
    case 'METRO':
      icon = <span className="text-[11px] font-bold font-display leading-none text-white">T</span>;
      break;
    case 'BUS':
      icon = <Bus className={iconClass} aria-hidden />;
      break;
    case 'FERRY':
      icon = <Ship className={iconClass} aria-hidden />;
      break;
    case 'TRANSFER':
      icon = <ArrowLeftRight className={iconClass} aria-hidden />;
      break;
    case 'TRAM':
      icon = <Train className={iconClass} aria-hidden />;
      break;
    case 'TRAIN':
    default:
      icon = <Train className={iconClass} aria-hidden />;
      break;
  }

  return (
    <span
      className="shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-md"
      style={{ backgroundColor: bg, boxShadow: `0 0 10px ${bg}66` }}
      title={label}
      aria-label={label}
    >
      {icon}
    </span>
  );
}
