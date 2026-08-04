import { describe, it, expect, vi } from 'vitest';
import type { UnifiedNotification } from '$lib/types';

vi.mock('./mute-rules.svelte', () => ({
  isNotificationMuted: (n: UnifiedNotification) => n.repository === 'acme/noisy'
}));

import { countBadgeUnread } from './notifications.svelte';

function notification(overrides: Partial<UnifiedNotification>): UnifiedNotification {
  return { id: 'n1', repository: 'acme/app', unread: true, ...overrides } as UnifiedNotification;
}

describe('countBadgeUnread', () => {
  it('counts unread notifications', () => {
    const items = [
      notification({ id: 'a' }),
      notification({ id: 'b' }),
      notification({ id: 'c', unread: false })
    ];
    expect(countBadgeUnread(items)).toBe(2);
  });

  it('excludes muted notifications, which the list also hides', () => {
    const items = [
      notification({ id: 'a' }),
      notification({ id: 'b', repository: 'acme/noisy' }),
      notification({ id: 'c', repository: 'acme/noisy' })
    ];
    expect(countBadgeUnread(items)).toBe(1);
  });

  it('returns 0 when every unread notification is muted', () => {
    const items = [
      notification({ id: 'a', repository: 'acme/noisy' }),
      notification({ id: 'b', repository: 'acme/noisy' })
    ];
    expect(countBadgeUnread(items)).toBe(0);
  });

  it('returns 0 for an empty list', () => {
    expect(countBadgeUnread([])).toBe(0);
  });
});
