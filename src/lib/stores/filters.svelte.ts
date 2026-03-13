import type { NotificationSource, NotificationType, SubjectState } from '$lib/types';

export type SortMode = 'date' | 'project';
export type StatusFilter = 'open' | 'closed';

interface FilterState {
  source: NotificationSource | 'all';
  project: string | null;
  sort: SortMode;
  types: Set<NotificationType>;
  projects: Set<string>;
  statuses: Set<StatusFilter>;
}

export const filterState: FilterState = $state({
  source: 'all',
  project: null,
  sort: 'date',
  types: new Set(),
  projects: new Set(),
  statuses: new Set()
});

export function setSourceFilter(source: NotificationSource | 'all'): void {
  filterState.source = source;
  filterState.project = null;
}

export function setProjectFilter(project: string | null): void {
  filterState.project = project;
}

export function setSortMode(sort: SortMode): void {
  filterState.sort = sort;
}

export function toggleTypeFilter(type: NotificationType): void {
  const next = new Set(filterState.types);
  if (next.has(type)) {
    next.delete(type);
  } else {
    next.add(type);
  }
  filterState.types = next;
}

export function clearTypeFilters(): void {
  filterState.types = new Set();
}

export function toggleProjectFilter(project: string): void {
  const next = new Set(filterState.projects);
  if (next.has(project)) {
    next.delete(project);
  } else {
    next.add(project);
  }
  filterState.projects = next;
}

export function clearProjectFilters(): void {
  filterState.projects = new Set();
}

export function toggleStatusFilter(status: StatusFilter): void {
  const next = new Set(filterState.statuses);
  if (next.has(status)) {
    next.delete(status);
  } else {
    next.add(status);
  }
  filterState.statuses = next;
}

export function clearStatusFilters(): void {
  filterState.statuses = new Set();
}

export function clearAllFilters(): void {
  filterState.types = new Set();
  filterState.projects = new Set();
  filterState.statuses = new Set();
}

export function hasActiveFilters(): boolean {
  return filterState.types.size > 0 || filterState.projects.size > 0 || filterState.statuses.size > 0;
}

export function resetFilters(): void {
  filterState.source = 'all';
  filterState.project = null;
  filterState.sort = 'date';
  filterState.types = new Set();
  filterState.projects = new Set();
  filterState.statuses = new Set();
}
