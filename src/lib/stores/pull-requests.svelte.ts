import type {
  UnifiedPullRequest,
  NotificationSource,
  PRRoleFilter,
  PRDraftFilter,
  PRCIFilter,
  PRMergeFilter
} from '$lib/types';
import { isServiceConnected, getGitHubConfig, getGitLabConfig } from './connections.svelte';
import { fetchGitHubPullRequestsBasic, enrichGitHubPR } from '$lib/services/github/pull-requests';
import { fetchGitLabMergeRequestsBasic, enrichGitLabMR } from '$lib/services/gitlab/pull-requests';
import { settingsState } from './settings.svelte';
import { isDemoMode } from './notifications.svelte';
import { demoPullRequests } from '$lib/utils/demo-data-prs';
import { mergeCachedEnrichment } from '$lib/utils/pr-enrichment-cache';

let pullRequests: UnifiedPullRequest[] = $state([]);
let isLoading = $state(false);
let hasLoadedOnce = $state(false);
let pollingTimer: ReturnType<typeof setInterval> | null = null;
let enrichmentController: AbortController | null = null;
let visibilityListener: (() => void) | null = null;
let lastVisibilityRefresh = 0;

// Minimum gap between refreshes triggered by the popover becoming visible, so
// rapid open/close toggling does not spam the API.
const SHOW_REFRESH_MIN_GAP_MS = 30_000;

// How many PRs are rendered initially and how many more each "Load more" adds.
// The full list is still fetched/enriched; this only bounds what is rendered.
const INITIAL_PR_DISPLAY = 30;
const PR_DISPLAY_STEP = 30;
let prDisplayLimit = $state(INITIAL_PR_DISPLAY);

export function getPRDisplayLimit(): number {
  return prDisplayLimit;
}

export function loadMorePRs(): void {
  prDisplayLimit += PR_DISPLAY_STEP;
}

export function resetPRDisplayLimit(): void {
  prDisplayLimit = INITIAL_PR_DISPLAY;
}

export function getPRCount(): number {
  return pullRequests.length;
}

export function getPRCountBySource(source: NotificationSource): number {
  return pullRequests.filter((pr) => pr.source === source).length;
}

export function getIsPRLoading(): boolean {
  return isLoading;
}

export function getPRHasLoadedOnce(): boolean {
  return hasLoadedOnce;
}

export type PRSortMode = 'updated' | 'created';

export function getUniquePRProjectsWithSource(): readonly {
  repository: string;
  source: NotificationSource;
}[] {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local computation, not reactive state
  const seen = new Map<string, NotificationSource>();
  for (const pr of pullRequests) {
    if (!seen.has(pr.repository)) {
      seen.set(pr.repository, pr.source);
    }
  }
  return [...seen.entries()]
    .map(([repository, source]) => ({ repository, source }))
    .sort((a, b) => a.repository.localeCompare(b.repository));
}

function prsForSource(sourceFilter: NotificationSource | 'all'): readonly UnifiedPullRequest[] {
  return sourceFilter === 'all'
    ? pullRequests
    : pullRequests.filter((pr) => pr.source === sourceFilter);
}

export function getPRCountByRole(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<PRRoleFilter, number> {
  const filtered = prsForSource(sourceFilter);
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local counting map, not state
  const counts = new Map<PRRoleFilter, number>();
  for (const pr of filtered) {
    const key: PRRoleFilter = pr.reviewRequestedFromMe ? 'review_requested' : 'authored';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function getPRCountByDraft(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<PRDraftFilter, number> {
  const filtered = prsForSource(sourceFilter);
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local counting map, not state
  const counts = new Map<PRDraftFilter, number>();
  for (const pr of filtered) {
    const key: PRDraftFilter = pr.draft ? 'draft' : 'ready';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function getPRCountByCI(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<PRCIFilter, number> {
  const filtered = prsForSource(sourceFilter);
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local counting map, not state
  const counts = new Map<PRCIFilter, number>();
  for (const pr of filtered) {
    if (pr.ciStatus === 'success' || pr.ciStatus === 'failure' || pr.ciStatus === 'pending') {
      counts.set(pr.ciStatus, (counts.get(pr.ciStatus) ?? 0) + 1);
    }
  }
  return counts;
}

export function countPRsByMerge(
  prs: readonly UnifiedPullRequest[]
): ReadonlyMap<PRMergeFilter, number> {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local counting map, not state
  const counts = new Map<PRMergeFilter, number>();
  for (const pr of prs) {
    if (pr.mergeStatus === 'mergeable') {
      counts.set('mergeable', (counts.get('mergeable') ?? 0) + 1);
    }
  }
  return counts;
}

export function getPRCountByMerge(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<PRMergeFilter, number> {
  return countPRsByMerge(prsForSource(sourceFilter));
}

export function getPRCountByProject(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<string, number> {
  const filtered = prsForSource(sourceFilter);
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local counting map, not state
  const counts = new Map<string, number>();
  for (const pr of filtered) {
    counts.set(pr.repository, (counts.get(pr.repository) ?? 0) + 1);
  }
  return counts;
}

export interface PRFilterOptions {
  readonly source?: NotificationSource | 'all';
  readonly role?: PRRoleFilter;
  readonly sort?: PRSortMode;
  readonly draft?: PRDraftFilter;
  readonly ci?: PRCIFilter;
  readonly merge?: PRMergeFilter;
  readonly projects?: ReadonlySet<string>;
}

/** Pure so the filter combinations stay testable without seeding store state. */
export function filterAndSortPRs(
  prs: readonly UnifiedPullRequest[],
  options: PRFilterOptions = {}
): readonly UnifiedPullRequest[] {
  const {
    source = 'all',
    role = 'all',
    sort = 'updated',
    draft = 'all',
    ci = 'all',
    merge = 'all',
    projects
  } = options;

  let filtered = [...prs];

  if (source !== 'all') {
    filtered = filtered.filter((pr) => pr.source === source);
  }

  if (role === 'authored') {
    filtered = filtered.filter((pr) => !pr.reviewRequestedFromMe);
  } else if (role === 'review_requested') {
    filtered = filtered.filter((pr) => pr.reviewRequestedFromMe);
  }

  if (draft === 'ready') {
    filtered = filtered.filter((pr) => !pr.draft);
  } else if (draft === 'draft') {
    filtered = filtered.filter((pr) => pr.draft);
  }

  if (ci !== 'all') {
    filtered = filtered.filter((pr) => pr.ciStatus === ci);
  }

  if (merge === 'mergeable') {
    filtered = filtered.filter((pr) => pr.mergeStatus === 'mergeable');
  }

  if (projects?.size) {
    filtered = filtered.filter((pr) => projects.has(pr.repository));
  }

  const dateKey = sort === 'created' ? 'createdAt' : 'updatedAt';
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- date parsing for sort comparison
  filtered.sort((a, b) => new Date(b[dateKey]).getTime() - new Date(a[dateKey]).getTime());

  return filtered;
}

export function getFilteredPRs(options: PRFilterOptions = {}): readonly UnifiedPullRequest[] {
  return filterAndSortPRs(pullRequests, options);
}

function updatePRs(updated: readonly UnifiedPullRequest[]): void {
  if (updated.length === 0) return;
  const byId = new Map(updated.map((pr) => [pr.id, pr]));
  pullRequests = pullRequests.map((pr) => byId.get(pr.id) ?? pr);
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
            return await enrichGitHubPR(githubConfig.token, pr, githubConfig.username, signal);
          }
          if (pr.source === 'gitlab' && gitlabConfig) {
            return await enrichGitLabMR(
              gitlabConfig.token,
              gitlabConfig.baseUrl,
              pr,
              gitlabConfig.username,
              signal
            );
          }
          return { ...pr, enrichment: 'skipped' as const };
        } catch {
          return { ...pr, enrichment: 'skipped' as const };
        }
      })
    );

    if (signal.aborted) return;
    updatePRs(enriched.filter((pr): pr is UnifiedPullRequest => pr !== null));
  }
}

export async function refreshPullRequests(): Promise<void> {
  if (isLoading) return;
  if (isDemoMode()) {
    loadDemoPRs();
    return;
  }
  isLoading = true;

  // Cancel any in-progress enrichment from previous poll
  if (enrichmentController) {
    enrichmentController.abort();
    enrichmentController = null;
  }

  // Snapshot the previous (enriched) list so unchanged PRs can reuse it.
  const previousPRs = pullRequests;

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

    // Phase 1: Display immediately, reusing enrichment from the previous poll
    // for PRs that have not changed so unchanged PRs are not re-fetched.
    pullRequests = mergeCachedEnrichment(results, previousPRs);
  } finally {
    isLoading = false;
    hasLoadedOnce = true;
  }

  // Phase 2: Enrich in background (if enabled), only the PRs still pending
  if (settingsState.enrichPullRequests) {
    enrichmentController = new AbortController();
    const pending = pullRequests.filter((pr) => pr.enrichment === 'pending');
    enrichAllPRs(pending, enrichmentController.signal).catch(() => {});
  } else {
    pullRequests = pullRequests.map((pr) => ({ ...pr, enrichment: 'skipped' as const }));
  }
}

function startPRInterval(): void {
  if (!pollingTimer) {
    pollingTimer = setInterval(refreshPullRequests, settingsState.pollingInterval * 1000);
  }
}

function pausePRInterval(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

// PR data feeds neither the tray badge nor desktop notifications, so there is
// no reason to keep polling while the popover is hidden. Pause the interval on
// hide and resume (with a throttled refresh) on show.
function handlePRVisibility(): void {
  if (typeof document === 'undefined') return;
  if (document.hidden) {
    pausePRInterval();
    return;
  }
  startPRInterval();
  const now = Date.now();
  if (now - lastVisibilityRefresh > SHOW_REFRESH_MIN_GAP_MS) {
    lastVisibilityRefresh = now;
    refreshPullRequests();
  }
}

export function startPRPolling(): void {
  stopPRPolling();
  lastVisibilityRefresh = Date.now();
  refreshPullRequests();
  startPRInterval();
  if (typeof document !== 'undefined' && !visibilityListener) {
    visibilityListener = handlePRVisibility;
    document.addEventListener('visibilitychange', visibilityListener);
  }
}

export function stopPRPolling(): void {
  if (enrichmentController) {
    enrichmentController.abort();
    enrichmentController = null;
  }
  pausePRInterval();
  if (visibilityListener && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', visibilityListener);
    visibilityListener = null;
  }
}

export function restartPRPolling(): void {
  startPRPolling();
}

export function loadDemoPRs(): void {
  pullRequests = [...demoPullRequests];
}
