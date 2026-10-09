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
vi.mock('$lib/stores/toast.svelte', () => ({ showToast: vi.fn() }));

const playLogo = vi.fn();
vi.mock('./logo-motion.svelte', () => ({ playLogo: (...args: unknown[]) => playLogo(...args) }));

import { updateFromBackend } from './notifications.svelte';

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

describe('logo pulse on new notifications', () => {
  beforeEach(() => {
    playLogo.mockClear();
    updateFromBackend([]);
    playLogo.mockClear();
  });

  it('pulses when a poll brings an unread item that was not known before', () => {
    updateFromBackend([notification('github-1')]);
    expect(playLogo).toHaveBeenCalledWith('pulse');
  });

  it('does not pulse again for items that were already known', () => {
    updateFromBackend([notification('github-1')]);
    playLogo.mockClear();
    updateFromBackend([notification('github-1')]);
    expect(playLogo).not.toHaveBeenCalled();
  });

  it('pulses only for the new item when another one is already known', () => {
    updateFromBackend([notification('github-1')]);
    playLogo.mockClear();
    updateFromBackend([notification('github-1'), notification('github-2')]);
    expect(playLogo).toHaveBeenCalledTimes(1);
  });

  it('does not pulse for items that arrive already read', () => {
    updateFromBackend([notification('github-3', { unread: false })]);
    expect(playLogo).not.toHaveBeenCalled();
  });
});
