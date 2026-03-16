import type { UnifiedPullRequest, NotificationSource, PRRoleFilter } from '$lib/types';
import { isServiceConnected, getGitHubConfig, getGitLabConfig } from './connections.svelte';
import { fetchGitHubPullRequests } from '$lib/services/github/pull-requests';
import { fetchGitLabMergeRequests } from '$lib/services/gitlab/pull-requests';
import { settingsState } from './settings.svelte';
import { demoPullRequests } from '$lib/utils/demo-data-prs';

let pullRequests: UnifiedPullRequest[] = $state([]);
let isLoading = $state(false);
let pollingTimer: ReturnType<typeof setInterval> | null = null;

export function getPRCount(): number {
  return pullRequests.length;
}

export function getPRCountBySource(source: NotificationSource): number {
  return pullRequests.filter((pr) => pr.source === source).length;
}

export function getIsPRLoading(): boolean {
  return isLoading;
}

export type PRSortMode = 'updated' | 'created';

export function getFilteredPRs(
  sourceFilter: NotificationSource | 'all',
  roleFilter: PRRoleFilter = 'all',
  sort: PRSortMode = 'updated'
): readonly UnifiedPullRequest[] {
  let filtered = [...pullRequests];

  if (sourceFilter !== 'all') {
    filtered = filtered.filter((pr) => pr.source === sourceFilter);
  }

  if (roleFilter === 'authored') {
    filtered = filtered.filter((pr) => !pr.reviewRequestedFromMe);
  } else if (roleFilter === 'review_requested') {
    filtered = filtered.filter((pr) => pr.reviewRequestedFromMe);
  }

  const dateKey = sort === 'created' ? 'createdAt' : 'updatedAt';
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- date parsing for sort comparison
  filtered.sort((a, b) => new Date(b[dateKey]).getTime() - new Date(a[dateKey]).getTime());

  return filtered;
}

export async function refreshPullRequests(): Promise<void> {
  if (isLoading) return;
  isLoading = true;

  try {
    const results: UnifiedPullRequest[] = [];
    const promises: Promise<void>[] = [];

    if (isServiceConnected('github')) {
      const config = getGitHubConfig();
      if (config) {
        promises.push(
          fetchGitHubPullRequests(config.token, config.username)
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
          fetchGitLabMergeRequests(config.token, config.baseUrl, config.username)
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

    pullRequests = results;
  } finally {
    isLoading = false;
  }
}

export function startPRPolling(): void {
  stopPRPolling();
  refreshPullRequests();
  pollingTimer = setInterval(refreshPullRequests, settingsState.pollingInterval * 1000);
}

export function stopPRPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

export function restartPRPolling(): void {
  startPRPolling();
}

export function loadDemoPRs(): void {
  pullRequests = [...demoPullRequests];
}
