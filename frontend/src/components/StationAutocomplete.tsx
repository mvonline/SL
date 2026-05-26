import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiClient } from '../services/api.js';
import { isStaticMode } from '../config/staticMode.js';
import type { Station } from '../types/index.js';
import { asText } from '../utils/safeText.js';

interface StationAutocompleteProps {
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  allStations: Station[];
  selected: Station | null;
  onSelect: (station: Station) => void;
}

function mergeStations(primary: Station[], extra: Station[]): Station[] {
  const seen = new Set<string>();
  const out: Station[] = [];
  for (const s of [...primary, ...extra]) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out.slice(0, 40);
}

export default function StationAutocomplete({
  label,
  placeholder,
  icon,
  allStations,
  selected,
  onSelect,
}: StationAutocompleteProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    if (selected) setQuery(selected.name);
  }, [selected]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(id);
  }, [query]);

  const { data: searchRes, isFetching: isSearching } = useQuery({
    queryKey: ['stationSearch', debouncedQuery],
    queryFn: () => ApiClient.searchStations(debouncedQuery),
    enabled: !isStaticMode && debouncedQuery.length >= 1,
    staleTime: 30_000,
  });

  const serverMatches =
    searchRes?.status === 'success' ? (searchRes.data as Station[]) : [];

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];

    const local = allStations.filter((s) => s.name.toLowerCase().includes(q));
    return mergeStations(local, serverMatches);
  }, [query, allStations, serverMatches]);

  const showList = open && query.trim().length >= 1;

  const pick = (station: Station) => {
    onSelect(station);
    setQuery(station.name);
    setOpen(false);
    setActiveIndex(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList || suggestions.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <label htmlFor={listId} className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </label>
      <div className="flex items-start gap-2">
        <span className="mt-2 flex-shrink-0">{icon}</span>
        <div className="flex-grow min-w-0 relative">
          <input
            ref={inputRef}
            id={listId}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-autocomplete="list"
            aria-controls={`${listId}-listbox`}
            autoComplete="off"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActiveIndex(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 150);
            }}
            onKeyDown={onKeyDown}
            className="w-full px-2.5 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none"
          />

          {showList && (
            <ul
              id={`${listId}-listbox`}
              role="listbox"
              className="absolute left-0 right-0 top-full mt-1 z-[300] max-h-52 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
            >
              {isSearching && suggestions.length === 0 && (
                <li className="px-2.5 py-2 text-xs text-slate-500">Searching…</li>
              )}
              {!isSearching && suggestions.length === 0 && (
                <li className="px-2.5 py-2 text-xs text-slate-500">No stations match &quot;{query.trim()}&quot;</li>
              )}
              {suggestions.map((s, idx) => (
                <li key={s.id} role="option" aria-selected={idx === activeIndex}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                    className={`w-full text-left px-2.5 py-2 text-xs border-b border-slate-800/80 last:border-b-0 transition ${
                      idx === activeIndex
                        ? 'bg-brand-cyan/15 text-slate-100'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="block text-[10px] text-slate-500">
                      {s.stop_type} · Zone {asText(s.tariff_zone, 'A')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
