import { useEffect, useState, useRef, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  LayersControl,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { Station, RouteLeg } from '../types/index.js';
import { loadMapStations } from '../services/stationsLoader.js';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Info, Layers } from 'lucide-react';
import { groupStationsByName, stationNameKey } from '../utils/groupStationsByName.js';
import { findNearestStation } from '../utils/findNearestStation.js';

import 'leaflet.markercluster';

type MarkerClusterGroup = L.LayerGroup & {
  clearLayers(): MarkerClusterGroup;
  addLayer(layer: L.Layer): MarkerClusterGroup;
};

type StopType = Station['stop_type'];

export type RoutePickMode = 'from' | 'to' | null;

interface MapProps {
  onSelectStation: (station: Station) => void;
  selectedStation: Station | null;
  activeRouteLegs: RouteLeg[] | null;
  activeRoutePoints: [number, number][] | null;
  routeFrom: Station | null;
  routeTo: Station | null;
  routePickMode: RoutePickMode;
  onPickStation: (station: Station, mode: 'from' | 'to') => void;
  pickStations: Station[];
}

const STOP_STYLE: Record<StopType, { color: string; char: string; label: string }> = {
  METRO: { color: '#EF4444', char: 'T', label: 'Metro' },
  TRAIN: { color: '#EC4899', char: 'J', label: 'Train' },
  BUS: { color: '#06B6D4', char: 'B', label: 'Bus' },
  FERRY: { color: '#3B82F6', char: 'F', label: 'Ferry' },
};

const ALL_STOP_TYPES: StopType[] = ['METRO', 'TRAIN', 'BUS', 'FERRY'];

/** Default map layers — all off; user enables types in the legend */
const DEFAULT_MAP_TYPES: StopType[] = [];

function MapViewportController({
  onZoomChange,
}: {
  onZoomChange: (zoom: number) => void;
}) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, []);

  return null;
}

function RefocusController({ selectedStation }: { selectedStation: Station | null }) {
  const map = useMap();
  const lastFocusedId = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedStation) {
      lastFocusedId.current = null;
      return;
    }
    if (lastFocusedId.current === selectedStation.id) return;
    lastFocusedId.current = selectedStation.id;

    const { latitude, longitude } = selectedStation;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    map.panTo([latitude, longitude], { animate: true, duration: 0.6 });
    const timer = window.setTimeout(() => map.invalidateSize(), 650);
    return () => window.clearTimeout(timer);
  }, [selectedStation, map]);

  return null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createStationMarker(
  station: Station,
  onSelect: (s: Station) => void,
  pickMode: RoutePickMode,
  onPick: (s: Station, mode: 'from' | 'to') => void
): L.Marker {
  const style = STOP_STYLE[station.stop_type] ?? STOP_STYLE.METRO;
  const customIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="marker-pin w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold font-display shadow-lg border-2 border-slate-900"
           style="background-color: ${style.color}; box-shadow: 0 0 12px ${style.color}80">
        ${style.char}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  const marker = L.marker([station.latitude, station.longitude], { icon: customIcon });
  const safeName = escapeHtml(station.name);
  const popupKey = escapeHtml(stationNameKey(station.name));
  const zones = escapeHtml(station.tariff_zone || 'A');
  const zoneLabel = station.tariff_zone?.includes(',') ? `Zones ${zones}` : `Zone ${zones}`;

  marker.bindPopup(`
    <div class="p-1 font-sans">
      <h3 class="text-sm font-bold text-slate-100 font-display mb-1">${safeName}</h3>
      <div class="flex items-center gap-1.5 text-xs text-slate-300">
        <span class="px-1.5 py-0.5 rounded font-bold text-[10px] text-white" style="background-color: ${style.color}">
          ${station.stop_type}
        </span>
        <span>${zoneLabel}</span>
      </div>
      <button id="pop-btn-${popupKey}" class="mt-2.5 w-full py-1 text-center text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-brand-cyan transition duration-150">
        View Departures
      </button>
    </div>
  `);

  marker.on('click', (e: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(e);
    if (pickMode === 'from' || pickMode === 'to') {
      onPick(station, pickMode);
      return;
    }
    onSelect(station);
  });

  marker.on('popupopen', () => {
    const btn = document.getElementById(`pop-btn-${popupKey}`);
    if (btn) {
      btn.onclick = () => {
        onSelect(station);
        marker.closePopup();
      };
    }
  });

  return marker;
}

/** All station markers on the map (not inside LayersControl — avoids overlay registration bugs) */
function MapRoutePicker({
  pickMode,
  pickStations,
  onPickStation,
}: {
  pickMode: RoutePickMode;
  pickStations: Station[];
  onPickStation: (station: Station, mode: 'from' | 'to') => void;
}) {
  const map = useMap();
  const pickModeRef = useRef(pickMode);
  const onPickRef = useRef(onPickStation);
  const stationsRef = useRef(pickStations);
  pickModeRef.current = pickMode;
  onPickRef.current = onPickStation;
  stationsRef.current = pickStations;

  useMapEvents({
    click(e) {
      const mode = pickModeRef.current;
      if (mode !== 'from' && mode !== 'to') return;

      const { lat, lng } = e.latlng;
      const nearest = findNearestStation(stationsRef.current, lat, lng);
      if (nearest) onPickRef.current(nearest.station, mode);
    },
  });

  useEffect(() => {
    const el = map.getContainer();
    if (pickMode) {
      el.classList.add('map-pick-mode');
      el.style.cursor = 'crosshair';
    } else {
      el.classList.remove('map-pick-mode');
      el.style.cursor = '';
    }
    return () => {
      el.classList.remove('map-pick-mode');
      el.style.cursor = '';
    };
  }, [pickMode, map]);

  return null;
}

function RouteEndpointMarkers({
  routeFrom,
  routeTo,
}: {
  routeFrom: Station | null;
  routeTo: Station | null;
}) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const group = L.layerGroup();
    layerRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      layerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    group.clearLayers();

    const addPin = (station: Station, color: string, label: string) => {
      const icon = L.divIcon({
        className: 'route-endpoint-icon',
        html: `
          <div class="flex flex-col items-center pointer-events-none">
            <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold font-display shadow-lg border-2 border-slate-950"
                 style="background-color: ${color}; box-shadow: 0 0 14px ${color}99">
              ${label}
            </div>
            <div class="mt-0.5 px-1.5 py-0.5 rounded bg-slate-950/90 text-[9px] text-slate-100 font-medium max-w-[120px] truncate border border-slate-700">
              ${escapeHtml(station.name)}
            </div>
          </div>
        `,
        iconSize: [120, 48],
        iconAnchor: [60, 22],
      });
      group.addLayer(
        L.marker([station.latitude, station.longitude], { icon, zIndexOffset: 1000 })
      );
    };

    if (routeFrom) addPin(routeFrom, '#10B981', 'A');
    if (routeTo) addPin(routeTo, '#EF4444', 'B');
  }, [routeFrom, routeTo]);

  return null;
}

function AllStationsMarkers({
  stations,
  visibleTypes,
  onSelectStation,
  routePickMode,
  onPickStation,
}: {
  stations: Station[];
  visibleTypes: Set<StopType>;
  onSelectStation: (station: Station) => void;
  routePickMode: RoutePickMode;
  onPickStation: (station: Station, mode: 'from' | 'to') => void;
}) {
  const map = useMap();
  const clusterRef = useRef<MarkerClusterGroup | null>(null);
  const onSelectRef = useRef(onSelectStation);
  const pickModeRef = useRef(routePickMode);
  const onPickRef = useRef(onPickStation);
  onSelectRef.current = onSelectStation;
  pickModeRef.current = routePickMode;
  onPickRef.current = onPickStation;

  const filtered = useMemo(() => {
    const byType = stations.filter((s) => visibleTypes.has(s.stop_type));
    return groupStationsByName(byType);
  }, [stations, visibleTypes]);

  useEffect(() => {
    const clusterGroup = (
      L as typeof L & { markerClusterGroup: (opts?: object) => MarkerClusterGroup }
    ).markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius: 35,
      disableClusteringAtZoom: 13,
      spiderfyOnMaxZoom: true,
      spiderfyOnEveryClick: true,
    });
    clusterRef.current = clusterGroup;
    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
      clusterRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const clusterGroup = clusterRef.current;
    if (!clusterGroup) return;

    clusterGroup.clearLayers();
    filtered.forEach((station) => {
      if (!Number.isFinite(station.latitude) || !Number.isFinite(station.longitude)) return;
      clusterGroup.addLayer(
        createStationMarker(
          station,
          (s) => onSelectRef.current(s),
          pickModeRef.current,
          (s, mode) => onPickRef.current(s, mode)
        )
      );
    });
  }, [filtered, routePickMode]);

  return null;
}

export default function Map({
  onSelectStation,
  selectedStation,
  activeRouteLegs,
  activeRoutePoints,
  routeFrom,
  routeTo,
  routePickMode,
  onPickStation,
  pickStations,
}: MapProps) {
  const [zoom, setZoom] = useState(13);
  const [visibleTypes, setVisibleTypes] = useState<Set<StopType>>(() => new Set(DEFAULT_MAP_TYPES));

  const { data: response, isFetching, isError: isQueryError } = useQuery({
    queryKey: ['stations', 'map'],
    queryFn: loadMapStations,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const stations = response?.status === 'success' ? response.data : [];
  const stationsForPick = pickStations.length > 0 ? pickStations : stations;
  const isError = isQueryError || response?.status === 'error';
  const stationsHint = response?.message;
  const usingFallback = response?.source === 'fallback';

  const countsByType = useMemo(() => {
    const counts: Record<StopType, number> = { METRO: 0, TRAIN: 0, BUS: 0, FERRY: 0 };
    stations.forEach((s) => {
      counts[s.stop_type] = (counts[s.stop_type] ?? 0) + 1;
    });
    return counts;
  }, [stations]);

  const toggleType = (type: StopType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const markersOnMap = useMemo(() => {
    const byType = stations.filter((s) => visibleTypes.has(s.stop_type));
    return groupStationsByName(byType).length;
  }, [stations, visibleTypes]);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[59.3301, 18.0601]}
        zoom={13}
        zoomControl={false}
        className="w-full h-full z-0"
      >
        <ZoomControl position="topright" />

        <LayersControl position="topleft" collapsed={false}>
          <LayersControl.BaseLayer checked name="Dark map">
            <TileLayer
              attribution='&copy; OSM &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Light map">
            <TileLayer
              attribution='&copy; OSM &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>

          {activeRoutePoints && (
            <LayersControl.Overlay checked name="Walking / driving route">
              <Polyline positions={activeRoutePoints} color="#06B6D4" weight={5} opacity={0.8} />
            </LayersControl.Overlay>
          )}

          {activeRouteLegs?.map((leg, index) => (
            <LayersControl.Overlay key={`leg-${index}`} checked name={`${leg.line}`}>
              <Polyline
                positions={leg.geometry}
                color={leg.color}
                weight={6}
                opacity={0.95}
                dashArray={leg.style === 'dotted' ? '4, 8' : undefined}
              />
            </LayersControl.Overlay>
          ))}
        </LayersControl>

        <AllStationsMarkers
          stations={stations}
          visibleTypes={visibleTypes}
          onSelectStation={onSelectStation}
          routePickMode={routePickMode}
          onPickStation={onPickStation}
        />

        <MapRoutePicker
          pickMode={routePickMode}
          pickStations={stationsForPick}
          onPickStation={onPickStation}
        />
        <RouteEndpointMarkers routeFrom={routeFrom} routeTo={routeTo} />

        <MapViewportController onZoomChange={setZoom} />
        <RefocusController selectedStation={selectedStation} />
      </MapContainer>

      {routePickMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <div className="glass-panel px-4 py-2 rounded-lg border border-brand-cyan/40 text-xs text-slate-100 shadow-lg">
            {routePickMode === 'from' ? (
              <span>
                Click the map or a station marker to set <strong className="text-emerald-400">Start</strong>
              </span>
            ) : (
              <span>
                Click the map or a station marker to set <strong className="text-red-400">Destination</strong>
              </span>
            )}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-[1000] glass-panel rounded-lg p-3 text-[11px] text-slate-300 max-w-[260px]">
        <h4 className="font-bold text-slate-100 flex items-center gap-1.5 mb-2">
          <Layers className="w-3.5 h-3.5 text-brand-cyan" />
          On map ({isFetching ? '…' : markersOnMap} stops, grouped by name)
        </h4>

        {isError && (
          <p className="text-[10px] text-red-400 mb-2">
            {stationsHint || 'Could not load stations.'}
          </p>
        )}
        {usingFallback && !isError && (
          <p className="text-[10px] text-amber-400/90 mb-2">{stationsHint}</p>
        )}
        {stations.length === 0 && !isFetching && !isError && (
          <p className="text-[10px] text-amber-400/90 mb-2">
            No stations available.
          </p>
        )}

        <p className="text-[10px] text-slate-500 mb-2">
          All station layers are off by default. Toggle types below:
        </p>
        <ul className="space-y-1.5 text-[10px]">
          {(ALL_STOP_TYPES as StopType[]).map((type) => (
            <li key={type}>
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={visibleTypes.has(type)}
                    onChange={() => toggleType(type)}
                    className="rounded border-slate-600 text-brand-cyan focus:ring-brand-cyan"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: STOP_STYLE[type].color }}
                  />
                  {STOP_STYLE[type].label}
                </span>
                <span className="text-slate-500 tabular-nums">{countsByType[type]}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-slate-500 mt-2 border-t border-slate-800 pt-2 flex items-center gap-1">
          <Info className="w-3 h-3 shrink-0" />
          Same name + multiple zones → one marker. Zoom {zoom}: clustering{' '}
          {zoom < 13 ? 'on' : 'off'}.
        </p>
      </div>
    </div>
  );
}
