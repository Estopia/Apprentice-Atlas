import { useSyncExternalStore } from 'react';

import type { JobFilter } from '@/types/jobs';

export type JobSort = 'recent' | 'distance' | 'title';

type DiscoveryState = {
  filters: JobFilter;
  sort: JobSort;
};

let state: DiscoveryState = { filters: {}, sort: 'recent' };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setDiscoveryFilters(filters: JobFilter) {
  state = { ...state, filters };
  emit();
}

export function updateDiscoveryFilters(update: Partial<JobFilter>) {
  state = { ...state, filters: { ...state.filters, ...update } };
  emit();
}

export function setDiscoverySort(sort: JobSort) {
  state = { ...state, sort };
  emit();
}

export function resetDiscoveryState() {
  state = { filters: {}, sort: 'recent' };
  emit();
}

export function getDiscoveryState() {
  return state;
}

export function useDiscoveryState() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    getDiscoveryState,
    getDiscoveryState,
  );
}
