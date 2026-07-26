import type { UnifiedIssue, NotificationSource, IssueRoleFilter } from '$lib/types';
import { isServiceConnected, getGitHubConfig, getGitLabConfig } from './connections.svelte';
import { fetchGitHubIssuesBasic } from '$lib/services/github/issues';
import { fetchGitLabIssuesBasic } from '$lib/services/gitlab/issues';
import { settingsState } from './settings.svelte';
import { isDemoMode } from './notifications.svelte';
import { demoIssues } from '$lib/utils/demo-data-issues';

let issues: UnifiedIssue[] = $state([]);
let isLoading = $state(false);
let hasLoadedOnce = $state(false);
let pollingTimer: ReturnType<typeof setInterval> | null = null;
let visibilityListener: (() => void) | null = null;
let lastVisibilityRefresh = 0;

// Minimum gap between refreshes triggered by the popover becoming visible, so
// rapid open/close toggling does not spam the API.
const SHOW_REFRESH_MIN_GAP_MS = 30_000;

export type IssueSortMode = 'updated' | 'created';

export function getIssueCount(): number {
  return issues.length;
}

export function getIssueCountBySource(source: NotificationSource): number {
  return issues.filter((issue) => issue.source === source).length;
}

export function getIsIssueLoading(): boolean {
  return isLoading;
}

export function getIssueHasLoadedOnce(): boolean {
  return hasLoadedOnce;
}

export function getUniqueIssueProjectsWithSource(): readonly {
  repository: string;
  source: NotificationSource;
}[] {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local computation, not reactive state
  const seen = new Map<string, NotificationSource>();
  for (const issue of issues) {
    if (!seen.has(issue.repository)) {
      seen.set(issue.repository, issue.source);
    }
  }
  return [...seen.entries()]
    .map(([repository, source]) => ({ repository, source }))
    .sort((a, b) => a.repository.localeCompare(b.repository));
}

export function getIssueCountByRole(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<IssueRoleFilter, number> {
  const filtered =
    sourceFilter === 'all' ? issues : issues.filter((issue) => issue.source === sourceFilter);
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local counting map, not state
  const counts = new Map<IssueRoleFilter, number>();
  for (const issue of filtered) {
    counts.set(issue.role, (counts.get(issue.role) ?? 0) + 1);
  }
  return counts;
}

export function getIssueCountByProject(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<string, number> {
  const filtered =
    sourceFilter === 'all' ? issues : issues.filter((issue) => issue.source === sourceFilter);
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local counting map, not state
  const counts = new Map<string, number>();
  for (const issue of filtered) {
    counts.set(issue.repository, (counts.get(issue.repository) ?? 0) + 1);
  }
  return counts;
}

export function getFilteredIssues(
  sourceFilter: NotificationSource | 'all',
  roleFilter: IssueRoleFilter = 'all',
  sort: IssueSortMode = 'updated',
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- parameter default, not reactive state
  projectsFilter: ReadonlySet<string> = new Set()
): readonly UnifiedIssue[] {
  let filtered = [...issues];

  if (sourceFilter !== 'all') {
    filtered = filtered.filter((issue) => issue.source === sourceFilter);
  }

  if (roleFilter !== 'all') {
    filtered = filtered.filter((issue) => issue.role === roleFilter);
  }

  if (projectsFilter.size > 0) {
    filtered = filtered.filter((issue) => projectsFilter.has(issue.repository));
  }

  const dateKey = sort === 'created' ? 'createdAt' : 'updatedAt';
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- date parsing for sort comparison
  filtered.sort((a, b) => new Date(b[dateKey]).getTime() - new Date(a[dateKey]).getTime());

  return filtered;
}

export async function refreshIssues(): Promise<void> {
  if (isLoading) return;
  if (!settingsState.enableIssues) return;
  if (isDemoMode()) {
    loadDemoIssues();
    return;
  }
  isLoading = true;

  try {
    const results: UnifiedIssue[] = [];
    const promises: Promise<void>[] = [];

    if (isServiceConnected('github')) {
      const config = getGitHubConfig();
      if (config) {
        promises.push(
          fetchGitHubIssuesBasic(config.token, config.username)
            .then((items) => {
              results.push(...items);
            })
            .catch(() => {
              // Silently skip failed service
            })
        );
      }
    }

    if (isServiceConnected('gitlab')) {
      const config = getGitLabConfig();
      if (config) {
        promises.push(
          fetchGitLabIssuesBasic(config.token, config.baseUrl, config.username)
            .then((items) => {
              results.push(...items);
            })
            .catch(() => {
              // Silently skip failed service
            })
        );
      }
    }

    await Promise.all(promises);

    // Sort by updatedAt descending
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- date parsing for sort comparison
    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    issues = results;
  } finally {
    isLoading = false;
    hasLoadedOnce = true;
  }
}

function startIssueInterval(): void {
  if (!pollingTimer) {
    pollingTimer = setInterval(refreshIssues, settingsState.pollingInterval * 1000);
  }
}

function pauseIssueInterval(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

// Issues feed neither the tray badge nor desktop notifications, so there is no
// reason to keep polling while the popover is hidden. Pause the interval on
// hide and resume (with a throttled refresh) on show.
function handleIssueVisibility(): void {
  if (typeof document === 'undefined') return;
  if (document.hidden) {
    pauseIssueInterval();
    return;
  }
  startIssueInterval();
  const now = Date.now();
  if (now - lastVisibilityRefresh > SHOW_REFRESH_MIN_GAP_MS) {
    lastVisibilityRefresh = now;
    refreshIssues();
  }
}

export function startIssuePolling(): void {
  stopIssuePolling();
  lastVisibilityRefresh = Date.now();
  refreshIssues();
  startIssueInterval();
  if (typeof document !== 'undefined' && !visibilityListener) {
    visibilityListener = handleIssueVisibility;
    document.addEventListener('visibilitychange', visibilityListener);
  }
}

export function stopIssuePolling(): void {
  pauseIssueInterval();
  if (visibilityListener && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', visibilityListener);
    visibilityListener = null;
  }
}

export function loadDemoIssues(): void {
  issues = [...demoIssues];
  hasLoadedOnce = true;
}
