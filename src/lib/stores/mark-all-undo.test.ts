import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

vi.mock('./connections.svelte', () => ({
  getGitHubConfig: () => ({ token: 'tok' }),
  getGitLabConfig: () => null
}));

const markAllGitHubNotificationsRead = vi.fn().mockResolvedValue(undefined);
const markGitHubThreadRead = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/services/github/client', () => ({
  markAllGitHubNotificationsRead: (...args: unknown[]) => markAllGitHubNotificationsRead(...args),
  markGitHubThreadRead: (...args: unknown[]) => markGitHubThreadRead(...args),
  markGitHubThreadDone: vi.fn()
}));
vi.mock('$lib/services/gitlab/client', () => ({
  markGitLabTodoDone: vi.fn(),
  markAllGitLabTodosDone: vi.fn()
}));

const showToast = vi.fn();
vi.mock('$lib/stores/toast.svelte', () => ({
  showToast: (...args: unknown[]) => showToast(...args)
}));

import {
  updateFromBackend,
  addSyntheticNotifications,
  markAllAsRead,
  undoMarkAllAsRead,
  getNotifications
} from './notifications.svelte';

function notification(id: string, overrides: Partial<UnifiedNotification> = {}) {
  return {
    id,
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

function unreadIds(): string[] {
  return getNotifications()
    .filter((n) => n.unread)
    .map((n) => n.id);
}

// markOnServers awaits two dynamic imports, so let the whole chain finish.
async function elapse(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 5; i++) {
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(0);
  }
}

describe('markAllAsRead with undo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // A bulk action left pending by the previous test lost its timer when the
    // fake clock was replaced, so drop it instead of letting it commit here.
    undoMarkAllAsRead();
    updateFromBackend([]);
    markAllGitHubNotificationsRead.mockClear();
    markGitHubThreadRead.mockClear();
    showToast.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks locally at once but waits before telling the server', async () => {
    updateFromBackend([notification('github-1'), notification('github-2')]);
    markAllAsRead();

    expect(unreadIds()).toEqual([]);
    await elapse(100);
    expect(markAllGitHubNotificationsRead).not.toHaveBeenCalled();
  });

  it('syncs to the server once the undo window has passed', async () => {
    updateFromBackend([notification('github-1'), notification('github-2')]);
    markAllAsRead();

    await elapse(3700);
    expect(markAllGitHubNotificationsRead).toHaveBeenCalledTimes(1);
  });

  it('offers Undo in the toast', () => {
    updateFromBackend([notification('github-1'), notification('github-2')]);
    markAllAsRead();

    expect(showToast).toHaveBeenCalledWith(
      '2 marked as read',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) })
    );
  });

  it('restores the unread state and never contacts the server on undo', async () => {
    updateFromBackend([notification('github-1'), notification('github-2')]);
    markAllAsRead();
    undoMarkAllAsRead();

    expect(unreadIds().sort()).toEqual(['github-1', 'github-2']);
    await elapse(5000);
    expect(markAllGitHubNotificationsRead).not.toHaveBeenCalled();
    expect(markGitHubThreadRead).not.toHaveBeenCalled();
  });

  it('keeps an undone item unread across a poll that still reports it', () => {
    updateFromBackend([notification('github-1'), notification('github-2')]);
    markAllAsRead();
    undoMarkAllAsRead();
    updateFromBackend([notification('github-1'), notification('github-2')]);

    expect(unreadIds().sort()).toEqual(['github-1', 'github-2']);
  });

  it('keeps an item read across a poll during the undo window', () => {
    updateFromBackend([notification('github-1'), notification('github-2')]);
    markAllAsRead();
    updateFromBackend([notification('github-1'), notification('github-2')]);

    expect(unreadIds()).toEqual([]);
  });

  it('commits a running bulk action before starting the next one', async () => {
    updateFromBackend([notification('github-1'), notification('github-2')]);
    markAllAsRead(new Set(['github-1']));
    markAllAsRead(new Set(['github-2']));
    await elapse(100);

    expect(markGitHubThreadRead).toHaveBeenCalledWith('tok', '1');
  });

  it('does nothing when there is nothing to undo', () => {
    expect(() => undoMarkAllAsRead()).not.toThrow();
  });

  it('restores synthetic entries too', () => {
    updateFromBackend([notification('github-1')]);
    addSyntheticNotifications([
      notification('beacon:pr-ready:github-pr-1', { synthetic: true, reason: 'ready_for_review' })
    ]);
    markAllAsRead();
    undoMarkAllAsRead();

    expect(unreadIds().sort()).toEqual(['beacon:pr-ready:github-pr-1', 'github-1']);
  });
});
