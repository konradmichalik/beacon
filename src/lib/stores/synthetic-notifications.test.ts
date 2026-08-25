import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UnifiedNotification } from '$lib/types';

const isNotificationMuted = vi.fn().mockReturnValue(false);
vi.mock('./mute-rules.svelte', () => ({
  isNotificationMuted: (...args: unknown[]) => isNotificationMuted(...args)
}));
vi.mock('./settings.svelte', () => ({
  settingsState: {
    notifyMode: 'disabled',
    notifySound: 'default',
    badgeMode: 'count',
    indicatorMode: 'none',
    indicatorColor: 'blue'
  }
}));
const playNotificationSound = vi.fn();
vi.mock('$lib/services/notification-sound', () => ({
  playNotificationSound: (...args: unknown[]) => playNotificationSound(...args)
}));
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

const markGitHubThreadRead = vi.fn().mockResolvedValue(undefined);
const markAllGitHubNotificationsRead = vi.fn().mockResolvedValue(undefined);
const markGitHubThreadDone = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/services/github/client', () => ({
  markGitHubThreadRead: (...args: unknown[]) => markGitHubThreadRead(...args),
  markAllGitHubNotificationsRead: (...args: unknown[]) => markAllGitHubNotificationsRead(...args),
  markGitHubThreadDone: (...args: unknown[]) => markGitHubThreadDone(...args),
  unsubscribeGitHubThread: vi.fn()
}));
vi.mock('$lib/services/gitlab/client', () => ({
  markGitLabTodoDone: vi.fn(),
  markAllGitLabTodosDone: vi.fn(),
  unsubscribeGitLabTarget: vi.fn()
}));

const showToast = vi.fn();
vi.mock('$lib/stores/toast.svelte', () => ({
  showToast: (...args: unknown[]) => showToast(...args)
}));

import {
  updateFromBackend,
  addSyntheticNotifications,
  pruneSyntheticNotifications,
  markAsRead,
  markAllAsRead,
  markAsDone,
  unsubscribeFromNotification,
  getNotifications,
  countBadgeUnread
} from './notifications.svelte';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function real(overrides: Partial<UnifiedNotification> = {}): UnifiedNotification {
  return {
    id: 'github-default',
    source: 'github',
    type: 'issue',
    title: 'Something',
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

function synthetic(overrides: Partial<UnifiedNotification> = {}): UnifiedNotification {
  return {
    id: 'beacon:pr-ready:github-pr-1',
    source: 'github',
    type: 'pull_request',
    title: 'My PR',
    repository: 'acme/app',
    url: 'https://github.com/acme/app/pull/1',
    reason: 'ready_for_review',
    unread: true,
    updatedAt: '2026-08-01T00:00:00Z',
    createdAt: '2026-08-01T00:00:00Z',
    author: null,
    subjectState: 'open',
    synthetic: true,
    ...overrides
  } as UnifiedNotification;
}

function find(id: string): UnifiedNotification | undefined {
  return getNotifications().find((n) => n.id === id);
}

describe('synthetic notifications in the notifications store', () => {
  beforeEach(async () => {
    await flushMicrotasks();
    vi.useRealTimers();
    getGitHubConfig.mockReturnValue({ token: 'tok' });
    isNotificationMuted.mockReturnValue(false);
    markGitHubThreadRead.mockClear();
    markAllGitHubNotificationsRead.mockClear();
    markGitHubThreadDone.mockClear();
    playNotificationSound.mockClear();
    showToast.mockClear();
    updateFromBackend([]);
  });

  it('survives two consecutive empty backend polls', () => {
    addSyntheticNotifications([synthetic({ id: 'beacon:pr-ready:github-pr-survive' })]);
    updateFromBackend([]);
    updateFromBackend([]);
    expect(find('beacon:pr-ready:github-pr-survive')).toBeDefined();
  });

  it('is not reverted to unread by the locallyReadIds absence-prune after being marked read', () => {
    addSyntheticNotifications([synthetic({ id: 'beacon:pr-ready:github-pr-readback' })]);
    markAsRead('beacon:pr-ready:github-pr-readback');
    updateFromBackend([]);
    expect(find('beacon:pr-ready:github-pr-readback')?.unread).toBe(false);
  });

  it('marking a synthetic entry read never calls a GitHub API', async () => {
    addSyntheticNotifications([synthetic({ id: 'beacon:pr-ready:github-pr-noapi' })]);
    markAsRead('beacon:pr-ready:github-pr-noapi');
    await flushMicrotasks();
    expect(markGitHubThreadRead).not.toHaveBeenCalled();
    expect(markAllGitHubNotificationsRead).not.toHaveBeenCalled();
  });

  it('marking a subset that includes a synthetic entry does not take the bulk GitHub path for the rest', async () => {
    updateFromBackend([
      real({ id: 'github-1' }),
      real({ id: 'github-2' }),
      real({ id: 'github-3' })
    ]);
    addSyntheticNotifications([synthetic({ id: 'beacon:pr-ready:github-pr-mixed' })]);

    markAllAsRead(new Set(['github-1', 'github-2', 'beacon:pr-ready:github-pr-mixed']));
    await flushMicrotasks();

    expect(markAllGitHubNotificationsRead).not.toHaveBeenCalled();
    expect(markGitHubThreadRead).toHaveBeenCalledWith('tok', '1');
    expect(markGitHubThreadRead).toHaveBeenCalledWith('tok', '2');
    expect(markGitHubThreadRead).not.toHaveBeenCalledWith('tok', expect.stringContaining('beacon'));
    expect(find('github-3')?.unread).toBe(true);
    expect(find('beacon:pr-ready:github-pr-mixed')?.unread).toBe(false);
  });

  it('takes the bulk GitHub path when every real unread notification is included alongside a synthetic one', async () => {
    updateFromBackend([real({ id: 'github-10' }), real({ id: 'github-11' })]);
    addSyntheticNotifications([synthetic({ id: 'beacon:pr-ready:github-pr-bulk' })]);

    markAllAsRead();
    await flushMicrotasks();

    expect(markAllGitHubNotificationsRead).toHaveBeenCalledTimes(1);
    expect(markGitHubThreadRead).not.toHaveBeenCalled();
  });

  it('is a no-op for markAsDone', () => {
    addSyntheticNotifications([synthetic({ id: 'beacon:pr-ready:github-pr-done' })]);
    markAsDone('beacon:pr-ready:github-pr-done');
    expect(markGitHubThreadDone).not.toHaveBeenCalled();
    expect(find('beacon:pr-ready:github-pr-done')).toBeDefined();
  });

  it('is a no-op for unsubscribeFromNotification', async () => {
    addSyntheticNotifications([synthetic({ id: 'beacon:pr-ready:github-pr-unsub' })]);
    await unsubscribeFromNotification('beacon:pr-ready:github-pr-unsub');
    expect(find('beacon:pr-ready:github-pr-unsub')?.unread).toBe(true);
  });

  it('counts toward the badge unread count', () => {
    const before = countBadgeUnread(getNotifications());
    addSyntheticNotifications([synthetic({ id: 'beacon:pr-ready:github-pr-badge' })]);
    expect(countBadgeUnread(getNotifications())).toBe(before + 1);
  });

  it('plays the notification sound when added and notifications are enabled', async () => {
    const settingsModule = await import('./settings.svelte');
    (settingsModule.settingsState as { notifyMode: string }).notifyMode = 'enabled';
    addSyntheticNotifications([synthetic({ id: 'beacon:pr-ready:github-pr-sound' })]);
    expect(playNotificationSound).toHaveBeenCalled();
    (settingsModule.settingsState as { notifyMode: string }).notifyMode = 'disabled';
  });

  it('does not play a sound for an entry that is muted on arrival', async () => {
    isNotificationMuted.mockReturnValue(true);
    const settingsModule = await import('./settings.svelte');
    (settingsModule.settingsState as { notifyMode: string }).notifyMode = 'enabled';
    addSyntheticNotifications([synthetic({ id: 'beacon:pr-ready:github-pr-muted' })]);
    expect(playNotificationSound).not.toHaveBeenCalled();
    (settingsModule.settingsState as { notifyMode: string }).notifyMode = 'disabled';
  });

  it('prunes an unread entry once it is older than 14 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    addSyntheticNotifications([
      synthetic({ id: 'beacon:pr-ready:github-pr-age', updatedAt: '2026-01-01T00:00:00Z' })
    ]);

    vi.setSystemTime(new Date('2026-01-10T00:00:00Z'));
    pruneSyntheticNotifications(new Set(['github-pr-age']));
    expect(find('beacon:pr-ready:github-pr-age')).toBeDefined();

    vi.setSystemTime(new Date('2026-01-16T00:00:00Z'));
    pruneSyntheticNotifications(new Set(['github-pr-age']));
    expect(find('beacon:pr-ready:github-pr-age')).toBeUndefined();

    vi.useRealTimers();
  });

  it('prunes a read entry once it is older than 3 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    addSyntheticNotifications([
      synthetic({ id: 'beacon:pr-ready:github-pr-readage', updatedAt: '2026-01-01T00:00:00Z' })
    ]);
    markAsRead('beacon:pr-ready:github-pr-readage');

    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    pruneSyntheticNotifications(new Set(['github-pr-readage']));
    expect(find('beacon:pr-ready:github-pr-readage')).toBeDefined();

    vi.setSystemTime(new Date('2026-01-05T00:00:00Z'));
    pruneSyntheticNotifications(new Set(['github-pr-readage']));
    expect(find('beacon:pr-ready:github-pr-readage')).toBeUndefined();

    vi.useRealTimers();
  });

  it('measures the 3-day read-pruning window from when it was actually marked read, not from detection', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    addSyntheticNotifications([
      synthetic({ id: 'beacon:pr-ready:github-pr-lateread', updatedAt: '2026-01-01T00:00:00Z' })
    ]);

    // Detected on day 0, but not read until day 5 — well inside the 14-day
    // unread window, so it must still be present right up to being read.
    vi.setSystemTime(new Date('2026-01-06T00:00:00Z'));
    pruneSyntheticNotifications(new Set(['github-pr-lateread']));
    expect(find('beacon:pr-ready:github-pr-lateread')).toBeDefined();
    markAsRead('beacon:pr-ready:github-pr-lateread');

    // One day after being read: must survive the 3-day read window.
    vi.setSystemTime(new Date('2026-01-07T00:00:00Z'));
    pruneSyntheticNotifications(new Set(['github-pr-lateread']));
    expect(find('beacon:pr-ready:github-pr-lateread')).toBeDefined();

    // Four days after being read: the read window has elapsed.
    vi.setSystemTime(new Date('2026-01-10T00:00:00Z'));
    pruneSyntheticNotifications(new Set(['github-pr-lateread']));
    expect(find('beacon:pr-ready:github-pr-lateread')).toBeUndefined();

    vi.useRealTimers();
  });

  it('drops an entry whose PR is no longer in the open PR set, when the set is known', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'));
    addSyntheticNotifications([
      synthetic({ id: 'beacon:pr-ready:github-pr-closed', updatedAt: '2026-08-01T00:00:00Z' })
    ]);
    pruneSyntheticNotifications(new Set());
    expect(find('beacon:pr-ready:github-pr-closed')).toBeUndefined();
    vi.useRealTimers();
  });

  it('does not prune by PR absence when the open PR set is unknown (a fetch failed)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'));
    addSyntheticNotifications([
      synthetic({ id: 'beacon:pr-ready:github-pr-unknown', updatedAt: '2026-08-01T00:00:00Z' })
    ]);
    pruneSyntheticNotifications(null);
    expect(find('beacon:pr-ready:github-pr-unknown')).toBeDefined();
    vi.useRealTimers();
  });
});
