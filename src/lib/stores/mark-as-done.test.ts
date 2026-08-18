import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UnifiedNotification } from '$lib/types';

vi.mock('./mute-rules.svelte', () => ({ isNotificationMuted: () => false }));
vi.mock('./settings.svelte', () => ({
  settingsState: {
    notifyMode: 'disabled',
    notifySound: 'default',
    badgeMode: 'count',
    indicatorMode: 'none',
    indicatorColor: 'blue'
  }
}));
vi.mock('$lib/services/notification-sound', () => ({ playNotificationSound: vi.fn() }));
vi.mock('$lib/utils/demo-data', () => ({ demoNotifications: [] }));
vi.mock('$lib/utils/storage', () => ({
  isTauri: () => false,
  getStorageItem: vi.fn().mockResolvedValue(null),
  setStorageItem: vi.fn().mockResolvedValue(undefined)
}));

const getGitHubConfig = vi.fn();
vi.mock('./connections.svelte', () => ({
  getGitHubConfig: (...args: unknown[]) => getGitHubConfig(...args),
  getGitLabConfig: () => null
}));

const markGitHubThreadDone = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/services/github/client', () => ({
  markGitHubThreadDone: (...args: unknown[]) => markGitHubThreadDone(...args),
  markGitHubThreadRead: vi.fn(),
  markAllGitHubNotificationsRead: vi.fn()
}));
vi.mock('$lib/services/gitlab/client', () => ({
  markGitLabTodoDone: vi.fn(),
  markAllGitLabTodosDone: vi.fn()
}));

const showToast = vi.fn();
vi.mock('$lib/stores/toast.svelte', () => ({
  showToast: (...args: unknown[]) => showToast(...args)
}));

import { updateFromBackend, markAsDone, getNotifications } from './notifications.svelte';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function notification(overrides: Partial<UnifiedNotification> = {}): UnifiedNotification {
  return {
    id: 'github-default',
    source: 'github',
    type: 'issue',
    title: 'Something broke',
    repository: 'acme/app',
    url: 'https://github.com/acme/app/issues/1',
    reason: 'mention',
    unread: true,
    updatedAt: '2026-08-01T00:00:00Z',
    createdAt: '2026-08-01T00:00:00Z',
    author: null,
    subjectState: null,
    ...overrides
  } as UnifiedNotification;
}

function ids(): string[] {
  return getNotifications().map((n) => n.id);
}

describe('markAsDone + dismissedIds overlay', () => {
  beforeEach(async () => {
    // Drain any fire-and-forget promise chain left pending by the previous
    // test (markAsDone's async work isn't awaited by callers) before
    // resetting mocks, so its late resolution can't leak into this test.
    await flushMicrotasks();
    vi.useRealTimers();
    getGitHubConfig.mockReturnValue({ token: 'tok' });
    markGitHubThreadDone.mockReset().mockResolvedValue(undefined);
    showToast.mockReset();
    updateFromBackend([]);
  });

  it('removes the notification from the list immediately', () => {
    updateFromBackend([notification({ id: 'github-remove' })]);
    markAsDone('github-remove');
    expect(ids()).not.toContain('github-remove');
  });

  it('is a no-op for GitLab notifications', () => {
    updateFromBackend([notification({ id: 'gitlab-noop', source: 'gitlab' })]);
    markAsDone('gitlab-noop');
    expect(ids()).toContain('gitlab-noop');
  });

  it('filters a dismissed id out of a poll that still carries it (in-flight race)', () => {
    updateFromBackend([notification({ id: 'github-race' })]);
    markAsDone('github-race');

    // A poll that started before the DELETE registered server-side still returns it.
    updateFromBackend([notification({ id: 'github-race' })]);
    expect(ids()).not.toContain('github-race');
  });

  it('prunes dismissed ids by age, not by absence from the poll payload', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    updateFromBackend([notification({ id: 'github-stale' })]);
    markAsDone('github-stale');

    // 10 days later, well inside the 30-day window: an absent payload must not
    // reset the dismissal, and a reappearing id must still be filtered out.
    vi.setSystemTime(new Date('2026-01-11T00:00:00Z'));
    updateFromBackend([]);
    updateFromBackend([notification({ id: 'github-stale' })]);
    expect(ids()).not.toContain('github-stale');

    // 31 days later: the bookkeeping entry has aged out.
    vi.setSystemTime(new Date('2026-02-02T00:00:00Z'));
    updateFromBackend([notification({ id: 'github-stale' })]);
    expect(ids()).toContain('github-stale');

    vi.useRealTimers();
  });

  it('shows a success toast only after the server request resolves', async () => {
    updateFromBackend([notification({ id: 'github-success' })]);
    markAsDone('github-success');

    expect(showToast).not.toHaveBeenCalled();

    await flushMicrotasks();
    expect(showToast).toHaveBeenCalledWith('Marked as done on GitHub — this cannot be undone');
  });

  it('rolls back the optimistic removal when the GitHub request fails', async () => {
    markGitHubThreadDone.mockRejectedValue(new Error('HTTP 403'));
    updateFromBackend([notification({ id: 'github-fail' })]);
    markAsDone('github-fail');

    expect(ids()).not.toContain('github-fail');

    await flushMicrotasks();

    expect(ids()).toContain('github-fail');
    expect(showToast).toHaveBeenCalledWith('Could not mark as done on GitHub');

    // The id must no longer be treated as dismissed, otherwise a later poll
    // would filter it back out again despite the rollback.
    updateFromBackend([notification({ id: 'github-fail' })]);
    expect(ids()).toContain('github-fail');
  });

  it('rolls back when there is no GitHub connection configured', async () => {
    getGitHubConfig.mockReturnValue(null);
    updateFromBackend([notification({ id: 'github-noconfig' })]);
    markAsDone('github-noconfig');

    expect(ids()).not.toContain('github-noconfig');

    await flushMicrotasks();

    expect(ids()).toContain('github-noconfig');
    expect(showToast).toHaveBeenCalledWith('Could not mark as done on GitHub');
    expect(markGitHubThreadDone).not.toHaveBeenCalled();
  });
});
