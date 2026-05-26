import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from './services/api.js';
import { Station, Departure, RouteLeg, RouteInstruction, RouteVehicleType } from './types/index.js';
import { asText } from './utils/safeText.js';
import { assignVehicleLegColors, syncInstructionColors } from './utils/routeLegColors.js';
import { isStaticMode } from './config/staticMode.js';
import { loadMapStations } from './services/stationsLoader.js';
import Map, { type RoutePickMode } from './components/Map.tsx';
import StationAutocomplete from './components/StationAutocomplete.tsx';
import { TripStepIcon, VEHICLE_LABELS } from './components/TripStepIcon.tsx';
import { Navigation, Train, RefreshCw, MapPin, AlertTriangle, Clock } from 'lucide-react';

export default function App() {
  const queryClient = useQueryClient();

  // Selected station departures panel state
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  
  // Routing Planner coordinates states
  const [routeFrom, setRouteFrom] = useState<Station | null>(null);
  const [routeTo, setRouteTo] = useState<Station | null>(null);
  const [travelMode, setTravelMode] = useState<'walking' | 'driving' | 'transit'>('transit');
  const [routePickMode, setRoutePickMode] = useState<RoutePickMode>(null);

  // 1. Fetch Real-time Departures for Selected Station (refetches every 12 seconds automatically)
  const { 
    data: departuresRes, 
    isFetching: isFetchingDepartures,
  } = useQuery({
    queryKey: ['departures', selectedStation?.id],
    queryFn: () => ApiClient.getLiveDepartures(selectedStation!.id),
    enabled: !!selectedStation,
    refetchInterval: 12000, // 12 seconds auto-refresh
  });

  // 2. Fetch Multi-Modal Routes via the BFF Proxy
  const {
    data: routingRes,
    isFetching: isFetchingRoute,
  } = useQuery({
    queryKey: ['routing', routeFrom?.id, routeTo?.id, travelMode],
    queryFn: () =>
      ApiClient.getRoute(
        routeFrom!.latitude,
        routeFrom!.longitude,
        routeTo!.latitude,
        routeTo!.longitude,
        travelMode,
        routeFrom!.name,
        routeTo!.name
      ),
    enabled: !!routeFrom && !!routeTo,
  });

  const { data: mapStationsRes } = useQuery({
    queryKey: ['stations', 'map'],
    queryFn: loadMapStations,
    staleTime: 60_000,
  });

  const handlePickStation = (station: Station, mode: 'from' | 'to') => {
    if (mode === 'from') setRouteFrom(station);
    else setRouteTo(station);
    setRoutePickMode(null);
    setSelectedStation(station);
  };

  const { data: allStationsRes } = useQuery({
    queryKey: ['stations', 'all'],
    queryFn: () => ApiClient.getStations(),
    staleTime: 60_000,
  });

  const allStations =
    allStationsRes?.status === 'success'
      ? (allStationsRes.data as Station[])
      : mapStationsRes?.status === 'success'
        ? mapStationsRes.data
        : [];

  // Determine if active departures query triggered a graceful fallback banner alert
  const departuresData =
    departuresRes?.status === 'success'
      ? (departuresRes.data as Record<string, unknown> | undefined)
      : null;
  const showAmberBanner =
    departuresRes?.source === 'cache_fallback' || (departuresRes?.warnings?.length ?? 0) > 0;
  const departuresList: Departure[] = useMemo(() => {
    const raw = departuresData?.departures;
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
      const d = item as Record<string, unknown>;
      return {
        line: asText(d.line ?? d.designation, '?'),
        destination: asText(d.destination ?? d.direction, 'Unknown'),
        display: asText(d.display ?? d.expected, '—'),
        expected: asText(d.expected),
        stopType: asText(d.stopType),
      };
    });
  }, [departuresData]);

  const routingPlan = useMemo(() => {
    if (routingRes?.status !== 'success') return null;
    const body = routingRes as Record<string, unknown>;
    const payload =
      body.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : body;

    const instructionsRaw = payload.instructions;
    const instructions: RouteInstruction[] = Array.isArray(instructionsRaw)
      ? instructionsRaw.map((item) => {
          const step = item as Record<string, unknown>;
          const vehicleRaw = step.vehicle;
          const vehicle =
            typeof vehicleRaw === 'string' &&
            ['WALK', 'METRO', 'TRAIN', 'BUS', 'FERRY', 'TRAM', 'TRANSFER'].includes(vehicleRaw)
              ? (vehicleRaw as RouteVehicleType)
              : undefined;
          return {
            text: asText(step.text, 'Continue'),
            durationMin: typeof step.durationMin === 'number' ? step.durationMin : undefined,
            line: step.line != null && step.line !== '' ? asText(step.line) : undefined,
            kind: step.kind as RouteInstruction['kind'],
            vehicle,
            color: typeof step.color === 'string' ? step.color : undefined,
          };
        })
      : [];

    const legsRaw = payload.legs;
    const legs: RouteLeg[] = Array.isArray(legsRaw) ? (legsRaw as RouteLeg[]) : [];

    return {
      mode: asText(payload.mode, 'transit') as 'walking' | 'driving' | 'transit',
      totalDurationMin:
        typeof payload.totalDurationMin === 'number' ? payload.totalDurationMin : undefined,
      durationSec: typeof payload.durationSec === 'number' ? payload.durationSec : undefined,
      interchanges: typeof payload.interchanges === 'number' ? payload.interchanges : 0,
      geometry: payload.geometry as [number, number][] | undefined,
      instructions,
      legs,
    };
  }, [routingRes]);

  const activeLegs: RouteLeg[] = useMemo(
    () => assignVehicleLegColors(routingPlan?.legs ?? []),
    [routingPlan?.legs]
  );
  const tripInstructions: RouteInstruction[] = useMemo(
    () => syncInstructionColors(routingPlan?.instructions ?? [], activeLegs),
    [routingPlan?.instructions, activeLegs]
  );
  const activePoints: [number, number][] | null = routingPlan?.geometry ?? null;

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-950 font-sans text-slate-100 antialiased">
      
      {/* Dynamic Graceful Degradation Amber Notification Banner */}
      {showAmberBanner && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-xl px-4 animate-bounce">
          <div className="flex items-center gap-3 p-3.5 bg-amber-500/90 text-slate-950 rounded-xl shadow-2xl backdrop-blur border border-amber-400 font-medium text-xs md:text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-slate-950" />
            <div className="flex-grow">
              <span className="font-bold">Central API Offline:</span> Displaying cached fallback data due to SL central server downtime.
            </div>
            <button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['departures'] })}
              className="px-2.5 py-1 text-[11px] font-bold rounded bg-slate-950/20 hover:bg-slate-950/40 text-slate-950 transition"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* 1. Sidebar Control Panel */}
      <aside className="w-[420px] h-full flex flex-col flex-shrink-0 border-r border-slate-900 bg-slate-950/95 z-50 overflow-y-auto">
        
        {/* App Title Head */}
        <header className="p-5 border-b border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-cyan to-brand-purple flex items-center justify-center shadow-lg shadow-brand-cyan/20 animate-pulse">
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-display tracking-tight text-white flex items-center gap-1.5">
                SthlmTransit
              </h1>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold font-display">
                {isStaticMode ? 'Offline DB · SL APIs' : 'Multimodal router'}
              </span>
            </div>
          </div>
        </header>

        <div className="flex-grow flex flex-col p-5 space-y-5 overflow-y-auto">
            {/* Travel Routing Planner */}
            <section className="glass-panel p-4 rounded-xl border border-slate-900">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5 text-brand-purple" /> Travel Route Planner
              </h2>
              
              <div className="space-y-3">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Type a station name, use <strong className="text-slate-400">Pick on map</strong>, or click a marker
                  while a layer is visible.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setRoutePickMode((m) => (m === 'from' ? null : 'from'))
                    }
                    className={`py-1.5 rounded-lg text-[10px] font-medium border transition ${
                      routePickMode === 'from'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {routePickMode === 'from' ? 'Cancel start pick' : 'Pick start on map'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRoutePickMode((m) => (m === 'to' ? null : 'to'))
                    }
                    className={`py-1.5 rounded-lg text-[10px] font-medium border transition ${
                      routePickMode === 'to'
                        ? 'bg-red-500/15 border-red-500 text-red-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {routePickMode === 'to' ? 'Cancel dest. pick' : 'Pick destination on map'}
                  </button>
                </div>

                <StationAutocomplete
                  label="Start"
                  placeholder="Type station name…"
                  icon={<MapPin className="w-4 h-4 text-emerald-400" />}
                  allStations={allStations}
                  selected={routeFrom}
                  onSelect={setRouteFrom}
                />

                <StationAutocomplete
                  label="Arrival"
                  placeholder="Type station name…"
                  icon={<MapPin className="w-4 h-4 text-red-400" />}
                  allStations={allStations}
                  selected={routeTo}
                  onSelect={setRouteTo}
                />

                {/* Mode Selectors */}
                <div className="grid grid-cols-3 gap-2">
                  {(['transit', 'walking', 'driving'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setTravelMode(mode)}
                      className={`py-1.5 rounded-lg text-xs font-medium border capitalize transition ${
                        travelMode === mode 
                          ? 'bg-brand-cyan/10 border-brand-cyan text-brand-cyan' 
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {routingRes?.status === 'error' && (
                  <p className="text-[10px] text-red-400/90">{asText(routingRes.message, 'Routing failed')}</p>
                )}

                {isFetchingRoute && (
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Calculating route…
                  </p>
                )}

                {routingPlan && tripInstructions.length > 0 && (
                  <div className="mt-3.5 max-h-[200px] overflow-y-auto border border-slate-800 rounded-lg bg-slate-900/30 p-2.5 space-y-2">
                    <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between pb-1.5 border-b border-slate-800">
                      <span>Trip plan</span>
                      <span className="text-brand-cyan">
                        {routingPlan.mode === 'transit'
                          ? `${routingPlan.totalDurationMin ?? '?'} min`
                          : `${Math.round((routingPlan.durationSec ?? 0) / 60)} min`}
                        {routingPlan.mode === 'transit' && routingPlan.interchanges > 0
                          ? ` · ${routingPlan.interchanges} change${routingPlan.interchanges > 1 ? 's' : ''}`
                          : ''}
                      </span>
                    </div>
                    {tripInstructions.map((step, idx) => {
                      const vehicle =
                        step.vehicle ??
                        (step.kind === 'walk'
                          ? 'WALK'
                          : step.kind === 'transfer'
                            ? 'TRANSFER'
                            : 'TRAIN');
                      return (
                      <div
                        key={idx}
                        className={`text-[11px] leading-normal flex items-start gap-2 ${
                          step.kind === 'transfer' ? 'text-amber-300' : 'text-slate-300'
                        }`}
                      >
                        <div className="flex flex-col items-center shrink-0 w-9 gap-0.5">
                          <TripStepIcon vehicle={vehicle} color={step.color} />
                          <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wide">
                            {VEHICLE_LABELS[vehicle]}
                          </span>
                        </div>
                        <div className="min-w-0 flex-grow">
                          {step.line && step.kind !== 'transfer' && step.kind !== 'walk' && (
                            <span
                              className="inline-block mb-0.5 mr-1 px-1 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-200 max-w-[100px] truncate align-middle"
                              style={step.color ? { borderLeft: `2px solid ${step.color}` } : undefined}
                            >
                              {step.line}
                            </span>
                          )}
                          <span>
                            {step.text}
                            {step.durationMin != null && step.durationMin > 0 && (
                              <span className="text-slate-500"> · {step.durationMin} min</span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* B. Live Departures Screen */}
            <section className="glass-panel p-4 rounded-xl border border-slate-900 flex-grow flex flex-col min-h-[220px]">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-brand-cyan" /> Selected Station Departures
                </span>
                {isFetchingDepartures && <RefreshCw className="w-3 h-3 text-brand-cyan animate-spin" />}
              </h2>

              {!selectedStation ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
                  <Train className="w-8 h-8 text-slate-700 mb-2 animate-bounce" />
                  <p className="text-xs text-slate-500 max-w-[220px]">
                    Click any station node on the interactive map to inspect real-time departures.
                  </p>
                </div>
              ) : (
                <div className="flex-grow flex flex-col space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white font-display leading-tight">{selectedStation.name}</h3>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>Zone {asText(selectedStation.tariff_zone, 'A')}</span>
                        <span>•</span>
                        <span>{selectedStation.stop_type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Route planning hooks */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRouteFrom(selectedStation)}
                      className="flex-1 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] border border-slate-800 text-emerald-400 transition"
                    >
                      Set as Start
                    </button>
                    <button
                      onClick={() => setRouteTo(selectedStation)}
                      className="flex-1 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] border border-slate-800 text-red-400 transition"
                    >
                      Set as End
                    </button>
                  </div>

                  {/* Departures Timetable */}
                  <div className="flex-grow max-h-[200px] overflow-y-auto space-y-2 border-t border-slate-900 pt-2.5">
                    {departuresList.length === 0 ? (
                      <p className="text-center text-xs text-slate-600 py-4">No scheduled departures detected.</p>
                    ) : (
                      departuresList.map((dep, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-slate-900/50 hover:bg-slate-900/80 rounded-lg border border-slate-900 transition">
                          <div className="flex items-center gap-2">
                            <span className="w-8 py-0.5 rounded font-bold text-[10px] text-center text-white bg-slate-800">
                              {dep.line}
                            </span>
                            <div className="text-xs text-slate-200 max-w-[150px] truncate">{dep.destination}</div>
                          </div>
                          <span className="text-xs font-bold text-brand-cyan">{dep.display}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </section>
        </div>
      </aside>

      {/* 2. Interactive Map Container Canvas */}
      <main className="flex-grow h-full relative">
        <Map
          onSelectStation={setSelectedStation}
          selectedStation={selectedStation}
          activeRouteLegs={activeLegs}
          activeRoutePoints={activePoints}
          routeFrom={routeFrom}
          routeTo={routeTo}
          routePickMode={routePickMode}
          onPickStation={handlePickStation}
          pickStations={allStations}
        />
      </main>

    </div>
  );
}
