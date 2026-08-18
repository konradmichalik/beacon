import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UnifiedNotification } from '$lib/types';

const showToast = vi.fn();
vi.mock('$lib/stores/toast.svelte', () => ({
  showToast: (...args: unknown[]) => showToast(...args)
}));

let storedValue: unknown = null;
vi.mock('$lib/utils/storage', () => ({
  isTauri: () => false,
  getStorageItem: vi.fn().mockImplementation(() => Promise.resolve(storedValue)),
  setStorageItem: vi.fn().mockImplementation((_key: string, value: unknown) => {
    storedValue = value;
    return Promise.resolve();
  })
}));

import {
  initializeSnoozed,
  snoozeNotification,
  unsnooze,
  isSnoozed,
  getSnoozedNotifications
} from './snooze.svelte';

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

describe('snooze store', () => {
  beforeEach(() => {
    vi.useRealTimers();
    storedValue = null;
  });

  it('is not snoozed before snoozeNotification is called', () => {
    expect(isSnoozed(notification({ id: 'never-snoozed' }))).toBe(false);
  });

  it('hides a notification immediately after snoozing it', () => {
    const n = notification({ id: 'snooze-immediate' });
    snoozeNotification(n, '1h', true);
    expect(isSnoozed(n)).toBe(true);
  });

  it('unsnooze makes it visible again', () => {
    const n = notification({ id: 'snooze-unsnooze' });
    snoozeNotification(n, '1h', true);
    unsnooze(n.id);
    expect(isSnoozed(n)).toBe(false);
  });

  it('wakes on new activity when enabled, independent of the timer', () => {
    const n = notification({ id: 'snooze-wake-activity', updatedAt: '2026-08-01T00:00:00Z' });
    snoozeNotification(n, 'monday', true);

    const updated = notification({
      id: 'snooze-wake-activity',
      updatedAt: '2026-08-02T00:00:00Z'
    });
    expect(isSnoozed(updated)).toBe(false);
  });

  it('stays asleep on new activity when wake-on-activity is disabled', () => {
    const n = notification({ id: 'snooze-no-wake', updatedAt: '2026-08-01T00:00:00Z' });
    snoozeNotification(n, 'monday', false);

    const updated = notification({ id: 'snooze-no-wake', updatedAt: '2026-08-02T00:00:00Z' });
    expect(isSnoozed(updated)).toBe(true);
  });

  it('getSnoozedNotifications filters a list down to the snoozed ones', () => {
    const a = notification({ id: 'list-a' });
    const b = notification({ id: 'list-b' });
    snoozeNotification(a, '1h', true);

    expect(getSnoozedNotifications([a, b]).map((n) => n.id)).toEqual(['list-a']);
  });

  it('prunes entries whose timer expired more than 30 days ago on load', async () => {
    const now = Date.now();
    storedValue = {
      'stale-entry': {
        until: new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString(),
        snapshotUpdatedAt: '2026-01-01T00:00:00Z',
        wakeOnUpdate: true
      },
      'fresh-entry': {
        until: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        snapshotUpdatedAt: '2026-01-01T00:00:00Z',
        wakeOnUpdate: true
      }
    };

    await initializeSnoozed();

    expect(isSnoozed(notification({ id: 'stale-entry' }))).toBe(false);
    expect(isSnoozed(notification({ id: 'fresh-entry', updatedAt: '2026-01-01T00:00:00Z' }))).toBe(
      true
    );
  });
});
