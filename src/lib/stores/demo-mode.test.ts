import { describe, it, expect, vi, beforeEach } from 'vitest';

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
vi.mock('$lib/utils/storage', () => ({
  isTauri: () => false,
  getStorageItem: vi.fn().mockResolvedValue(null),
  setStorageItem: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/stores/toast.svelte', () => ({ showToast: vi.fn() }));

// Deliberately NOT mocking $lib/utils/demo-data — this test exercises the real
// demo fixtures, including the synthetic ones, to catch exactly the kind of
// duplication a mocked-away demoNotifications list would hide.
import { loadDemoData, getNotifications, markAsRead, markAllAsRead } from './notifications.svelte';
import { demoNotifications } from '$lib/utils/demo-data';

describe('demo mode with synthetic fixtures', () => {
  beforeEach(() => {
    loadDemoData();
  });

  it('has at least one synthetic fixture to exercise this path', () => {
    expect(demoNotifications.some((n) => n.synthetic)).toBe(true);
  });

  it('renders each demo notification exactly once', () => {
    const ids = getNotifications().map((n) => n.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
    expect(ids.length).toBe(demoNotifications.length);
  });

  it('does not duplicate a synthetic entry after marking it read', () => {
    const synthetic = demoNotifications.find((n) => n.synthetic);
    if (!synthetic) throw new Error('fixture must include a synthetic entry');

    markAsRead(synthetic.id);

    const matches = getNotifications().filter((n) => n.id === synthetic.id);
    expect(matches).toHaveLength(1);
    expect(matches[0].unread).toBe(false);
  });

  it('does not duplicate synthetic entries after marking all as read', () => {
    markAllAsRead();

    const ids = getNotifications().map((n) => n.id);
    expect(ids.length).toBe(new Set(ids).size);
    expect(getNotifications().every((n) => !n.unread)).toBe(true);
  });
});
