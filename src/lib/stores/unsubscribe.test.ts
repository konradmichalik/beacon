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

const showToast = vi.fn();
vi.mock('$lib/stores/toast.svelte', () => ({
  showToast: (...args: unknown[]) => showToast(...args)
}));
vi.mock('$lib/utils/demo-data', () => ({ demoNotifications: [] }));
vi.mock('$lib/utils/storage', () => ({
  isTauri: () => false,
  getStorageItem: vi.fn().mockResolvedValue(null),
  setStorageItem: vi.fn().mockResolvedValue(undefined)
}));

const getGitHubConfig = vi.fn();
const getGitLabConfig = vi.fn();
vi.mock('./connections.svelte', () => ({
  getGitHubConfig: (...args: unknown[]) => getGitHubConfig(...args),
  getGitLabConfig: (...args: unknown[]) => getGitLabConfig(...args)
}));

const unsubscribeGitHubThread = vi.fn();
vi.mock('$lib/services/github/client', () => ({
  unsubscribeGitHubThread: (...args: unknown[]) => unsubscribeGitHubThread(...args),
  markGitHubThreadDone: vi.fn(),
  markGitHubThreadRead: vi.fn(),
  markAllGitHubNotificationsRead: vi.fn()
}));

const unsubscribeGitLabTarget = vi.fn();
vi.mock('$lib/services/gitlab/client', () => ({
  unsubscribeGitLabTarget: (...args: unknown[]) => unsubscribeGitLabTarget(...args),
  markGitLabTodoDone: vi.fn(),
  markAllGitLabTodosDone: vi.fn()
}));

import {
  updateFromBackend,
  unsubscribeFromNotification,
  getNotifications
} from './notifications.svelte';

function notification(overrides: Partial<UnifiedNotification> = {}): UnifiedNotification {
  return {
    id: 'github-1',
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

function findUnread(id: string): boolean | undefined {
  return getNotifications().find((n) => n.id === id)?.unread;
}

describe('unsubscribeFromNotification', () => {
  beforeEach(() => {
    showToast.mockReset();
    unsubscribeGitHubThread.mockReset().mockResolvedValue(undefined);
    unsubscribeGitLabTarget.mockReset().mockResolvedValue(undefined);
    getGitHubConfig.mockReturnValue({ token: 'gh-tok' });
    getGitLabConfig.mockReturnValue({ token: 'gl-tok', baseUrl: 'https://gitlab.com' });
    updateFromBackend([]);
  });

  it('unsubscribes a GitHub thread and marks it read on success', async () => {
    updateFromBackend([notification({ id: 'github-501' })]);

    await unsubscribeFromNotification('github-501');

    expect(unsubscribeGitHubThread).toHaveBeenCalledWith('gh-tok', '501');
    expect(findUnread('github-501')).toBe(false);
  });

  it('leaves the notification untouched when the GitHub request fails', async () => {
    unsubscribeGitHubThread.mockRejectedValue(new Error('HTTP 403'));
    updateFromBackend([notification({ id: 'github-fail' })]);

    await unsubscribeFromNotification('github-fail');

    expect(findUnread('github-fail')).toBe(true);
    expect(showToast).toHaveBeenCalledWith('Unsubscribe failed');
  });

  it('unsubscribes a GitLab merge request using the parsed project path and iid', async () => {
    updateFromBackend([
      notification({
        id: 'gitlab-mr',
        source: 'gitlab',
        type: 'merge_request',
        url: 'https://gitlab.com/acme/project/-/merge_requests/42'
      })
    ]);

    await unsubscribeFromNotification('gitlab-mr');

    expect(unsubscribeGitLabTarget).toHaveBeenCalledWith(
      'gl-tok',
      'https://gitlab.com',
      'acme/project',
      'merge_requests',
      42
    );
    expect(findUnread('gitlab-mr')).toBe(false);
  });

  it('fails without a request for a GitLab target it cannot parse (e.g. a pipeline)', async () => {
    updateFromBackend([
      notification({
        id: 'gitlab-pipeline',
        source: 'gitlab',
        type: 'pipeline',
        url: 'https://gitlab.com/acme/project/-/pipelines/99'
      })
    ]);

    await unsubscribeFromNotification('gitlab-pipeline');

    expect(unsubscribeGitLabTarget).not.toHaveBeenCalled();
    expect(findUnread('gitlab-pipeline')).toBe(true);
    expect(showToast).toHaveBeenCalledWith('Unsubscribe failed');
  });
});
