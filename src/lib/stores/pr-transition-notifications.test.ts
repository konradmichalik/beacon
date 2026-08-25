import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UnifiedPullRequest } from '$lib/types';

vi.mock('./mute-rules.svelte', () => ({ isNotificationMuted: () => false }));
vi.mock('./settings.svelte', () => ({
  settingsState: {
    notifyMode: 'disabled',
    notifySound: 'default',
    badgeMode: 'count',
    indicatorMode: 'none',
    indicatorColor: 'blue',
    enrichPullRequests: false,
    pollingInterval: 60
  }
}));
vi.mock('$lib/services/notification-sound', () => ({ playNotificationSound: vi.fn() }));
vi.mock('$lib/utils/demo-data', () => ({ demoNotifications: [] }));
vi.mock('$lib/utils/demo-data-prs', () => ({ demoPullRequests: [] }));
vi.mock('$lib/utils/storage', () => ({
  isTauri: () => false,
  getStorageItem: vi.fn().mockResolvedValue(null),
  setStorageItem: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/stores/toast.svelte', () => ({ showToast: vi.fn() }));
vi.mock('./notifications.svelte', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./notifications.svelte')>();
  return { ...actual, isDemoMode: () => false };
});

vi.mock('./connections.svelte', () => ({
  isServiceConnected: (service: string) => service === 'github',
  getGitHubConfig: () => ({ token: 'tok', username: 'octocat' }),
  getGitLabConfig: () => null
}));

const fetchGitHubPullRequestsBasic = vi.fn();
const enrichGitHubPR = vi.fn();
vi.mock('$lib/services/github/pull-requests', () => ({
  fetchGitHubPullRequestsBasic: (...args: unknown[]) => fetchGitHubPullRequestsBasic(...args),
  enrichGitHubPR: (...args: unknown[]) => enrichGitHubPR(...args)
}));
vi.mock('$lib/services/gitlab/pull-requests', () => ({
  fetchGitLabMergeRequestsBasic: vi.fn().mockResolvedValue({ items: [], complete: true }),
  enrichGitLabMR: vi.fn()
}));

import { refreshPullRequests } from './pull-requests.svelte';
import { getNotifications } from './notifications.svelte';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function basicPR(overrides: Partial<UnifiedPullRequest> = {}): UnifiedPullRequest {
  return {
    id: 'github-pr-1',
    source: 'github',
    title: 'Add feature',
    repository: 'octocat/hello-world',
    url: 'https://github.com/octocat/hello-world/pull/1',
    number: 1,
    draft: true,
    author: { login: 'octocat', avatarUrl: 'https://example.com/a.png' },
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ciStatus: 'unknown',
    reviewDecision: null,
    mergeStatus: 'unknown',
    reviewRequestedFromMe: true,
    reviewedByMe: false,
    enrichment: 'pending',
    ...overrides
  };
}

function synthetic(id: string) {
  return getNotifications().find((n) => n.id === id);
}

describe('PR draft-to-ready transitions surface as synthetic notifications', () => {
  beforeEach(() => {
    fetchGitHubPullRequestsBasic.mockReset();
    enrichGitHubPR.mockReset();
  });

  it('creates one synthetic entry when a review-requested PR leaves draft between two polls', async () => {
    fetchGitHubPullRequestsBasic.mockResolvedValueOnce({
      items: [basicPR({ draft: true })],
      complete: true
    });
    await refreshPullRequests();
    await flushMicrotasks();
    expect(synthetic('beacon:pr-ready:github-pr-1')).toBeUndefined();

    fetchGitHubPullRequestsBasic.mockResolvedValueOnce({
      items: [basicPR({ draft: false, updatedAt: '2026-08-02T00:00:00Z' })],
      complete: true
    });
    await refreshPullRequests();
    await flushMicrotasks();

    const notification = synthetic('beacon:pr-ready:github-pr-1');
    expect(notification).toBeDefined();
    expect(notification?.reason).toBe('ready_for_review');
    expect(notification?.unread).toBe(true);

    // A third, unchanged poll must not create a duplicate or re-fire.
    fetchGitHubPullRequestsBasic.mockResolvedValueOnce({
      items: [basicPR({ draft: false, updatedAt: '2026-08-02T00:00:00Z' })],
      complete: true
    });
    await refreshPullRequests();
    await flushMicrotasks();
    expect(getNotifications().filter((n) => n.id === 'beacon:pr-ready:github-pr-1')).toHaveLength(
      1
    );
  });

  it('never fires for a PR that is already ready on the very first poll', async () => {
    fetchGitHubPullRequestsBasic.mockResolvedValueOnce({
      items: [basicPR({ id: 'github-pr-2', draft: false })],
      complete: true
    });
    await refreshPullRequests();
    await flushMicrotasks();
    expect(synthetic('beacon:pr-ready:github-pr-2')).toBeUndefined();
  });

  it('does not prune a synthetic entry when the PR disappears from an incomplete poll', async () => {
    fetchGitHubPullRequestsBasic.mockResolvedValueOnce({
      items: [basicPR({ id: 'github-pr-3', draft: true })],
      complete: true
    });
    await refreshPullRequests();
    await flushMicrotasks();

    fetchGitHubPullRequestsBasic.mockResolvedValueOnce({
      items: [basicPR({ id: 'github-pr-3', draft: false, updatedAt: '2026-08-02T00:00:00Z' })],
      complete: true
    });
    await refreshPullRequests();
    await flushMicrotasks();
    expect(synthetic('beacon:pr-ready:github-pr-3')).toBeDefined();

    // The PR is gone from this poll's results, but the poll itself is
    // reported incomplete (e.g. one of the two GitHub searches failed) — the
    // entry must survive since absence here is inconclusive, not confirmed.
    fetchGitHubPullRequestsBasic.mockResolvedValueOnce({ items: [], complete: false });
    await refreshPullRequests();
    await flushMicrotasks();
    expect(synthetic('beacon:pr-ready:github-pr-3')).toBeDefined();

    // A genuinely complete poll confirming the PR is gone now prunes it.
    fetchGitHubPullRequestsBasic.mockResolvedValueOnce({ items: [], complete: true });
    await refreshPullRequests();
    await flushMicrotasks();
    expect(synthetic('beacon:pr-ready:github-pr-3')).toBeUndefined();
  });
});
