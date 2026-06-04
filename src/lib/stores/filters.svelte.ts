import { SvelteSet } from 'svelte/reactivity';
import type { NotificationSource, NotificationType } from '$lib/types';

export type SortMode = 'date' | 'project';
export type StatusFilter = 'open' | 'closed';
export type NotificationDraftFilter = 'all' | 'ready' | 'draft';

interface FilterState {
  source: NotificationSource | 'all';
  project: string | null;
  sort: SortMode;
  types: SvelteSet<NotificationType>;
  projects: SvelteSet<string>;
  statuses: SvelteSet<StatusFilter>;
  authors: SvelteSet<string>;
  draftFilter: NotificationDraftFilter;
}

export const filterState: FilterState = $state({
  source: 'all',
  project: null,
  sort: 'date',
  types: new SvelteSet(),
  projects: new SvelteSet(),
  statuses: new SvelteSet(),
  authors: new SvelteSet(),
  draftFilter: 'all'
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
  if (filterState.types.has(type)) {
    filterState.types.delete(type);
  } else {
    filterState.types.add(type);
  }
}

export function clearTypeFilters(): void {
  filterState.types.clear();
}

export function toggleProjectFilter(project: string): void {
  if (filterState.projects.has(project)) {
    filterState.projects.delete(project);
  } else {
    filterState.projects.add(project);
  }
}

export function clearProjectFilters(): void {
  filterState.projects.clear();
}

export function toggleStatusFilter(status: StatusFilter): void {
  if (filterState.statuses.has(status)) {
    filterState.statuses.delete(status);
  } else {
    filterState.statuses.add(status);
  }
}

export function clearStatusFilters(): void {
  filterState.statuses.clear();
}

export function toggleAuthorFilter(author: string): void {
  if (filterState.authors.has(author)) {
    filterState.authors.delete(author);
  } else {
    filterState.authors.add(author);
  }
}

export function clearAuthorFilters(): void {
  filterState.authors.clear();
}

export function setDraftFilter(filter: NotificationDraftFilter): void {
  filterState.draftFilter = filter;
}

export function clearAllFilters(): void {
  filterState.types.clear();
  filterState.projects.clear();
  filterState.statuses.clear();
  filterState.authors.clear();
  filterState.draftFilter = 'all';
}

export function hasActiveFilters(): boolean {
  return (
    filterState.types.size > 0 ||
    filterState.projects.size > 0 ||
    filterState.statuses.size > 0 ||
    filterState.authors.size > 0 ||
    filterState.draftFilter !== 'all'
  );
}

export function resetFilters(): void {
  filterState.source = 'all';
  filterState.project = null;
  filterState.sort = 'date';
  filterState.types.clear();
  filterState.projects.clear();
  filterState.statuses.clear();
  filterState.authors.clear();
  filterState.draftFilter = 'all';
}
