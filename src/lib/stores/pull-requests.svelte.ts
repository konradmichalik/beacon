import type {
  UnifiedPullRequest,
  NotificationSource,
  PRRoleFilter,
  PRDraftFilter,
  PRCIFilter
} from '$lib/types';
import { isServiceConnected, getGitHubConfig, getGitLabConfig } from './connections.svelte';
import { fetchGitHubPullRequestsBasic, enrichGitHubPR } from '$lib/services/github/pull-requests';
import { fetchGitLabMergeRequestsBasic, enrichGitLabMR } from '$lib/services/gitlab/pull-requests';
import { settingsState } from './settings.svelte';
import { demoPullRequests } from '$lib/utils/demo-data-prs';

let pullRequests: UnifiedPullRequest[] = $state([]);
let isLoading = $state(false);
let pollingTimer: ReturnType<typeof setInterval> | null = null;
let enrichmentController: AbortController | null = null;

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
  sort: PRSortMode = 'updated',
  draftFilter: PRDraftFilter = 'all',
  ciFilter: PRCIFilter = 'all'
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

  if (draftFilter === 'ready') {
    filtered = filtered.filter((pr) => !pr.draft);
  } else if (draftFilter === 'draft') {
    filtered = filtered.filter((pr) => pr.draft);
  }

  if (ciFilter !== 'all') {
    filtered = filtered.filter((pr) => pr.ciStatus === ciFilter);
  }

  const dateKey = sort === 'created' ? 'createdAt' : 'updatedAt';
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- date parsing for sort comparison
  filtered.sort((a, b) => new Date(b[dateKey]).getTime() - new Date(a[dateKey]).getTime());

  return filtered;
}

function updatePR(updated: UnifiedPullRequest): void {
  pullRequests = pullRequests.map((pr) => (pr.id === updated.id ? updated : pr));
}

const ENRICHMENT_BATCH_SIZE = 3;

async function enrichAllPRs(
  prs: readonly UnifiedPullRequest[],
  signal: AbortSignal
): Promise<void> {
  const githubConfig = isServiceConnected('github') ? getGitHubConfig() : null;
  const gitlabConfig = isServiceConnected('gitlab') ? getGitLabConfig() : null;

  for (let i = 0; i < prs.length; i += ENRICHMENT_BATCH_SIZE) {
    if (signal.aborted) return;

    const batch = prs.slice(i, i + ENRICHMENT_BATCH_SIZE);
    const enriched = await Promise.all(
      batch.map(async (pr) => {
        if (signal.aborted) return null;
        try {
          if (pr.source === 'github' && githubConfig) {
            return await enrichGitHubPR(githubConfig.token, pr, githubConfig.username);
          }
          if (pr.source === 'gitlab' && gitlabConfig) {
            return await enrichGitLabMR(
              gitlabConfig.token,
              gitlabConfig.baseUrl,
              pr,
              gitlabConfig.username
            );
          }
          return { ...pr, enrichment: 'skipped' as const };
        } catch {
          return { ...pr, enrichment: 'skipped' as const };
        }
      })
    );

    if (signal.aborted) return;
    for (const pr of enriched) {
      if (pr) updatePR(pr);
    }
  }
}

export async function refreshPullRequests(): Promise<void> {
  if (isLoading) return;
  isLoading = true;

  // Cancel any in-progress enrichment from previous poll
  if (enrichmentController) {
    enrichmentController.abort();
    enrichmentController = null;
  }

  try {
    const results: UnifiedPullRequest[] = [];
    const promises: Promise<void>[] = [];

    if (isServiceConnected('github')) {
      const config = getGitHubConfig();
      if (config) {
        promises.push(
          fetchGitHubPullRequestsBasic(config.token, config.username)
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
          fetchGitLabMergeRequestsBasic(config.token, config.baseUrl, config.username)
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

    // Phase 1: Display immediately
    pullRequests = results;
  } finally {
    isLoading = false;
  }

  // Phase 2: Enrich in background (if enabled)
  if (settingsState.enrichPullRequests) {
    enrichmentController = new AbortController();
    enrichAllPRs(pullRequests, enrichmentController.signal).catch(() => {});
  } else {
    pullRequests = pullRequests.map((pr) => ({ ...pr, enrichment: 'skipped' as const }));
  }
}

export function startPRPolling(): void {
  stopPRPolling();
  refreshPullRequests();
  pollingTimer = setInterval(refreshPullRequests, settingsState.pollingInterval * 1000);
}

export function stopPRPolling(): void {
  if (enrichmentController) {
    enrichmentController.abort();
    enrichmentController = null;
  }
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
