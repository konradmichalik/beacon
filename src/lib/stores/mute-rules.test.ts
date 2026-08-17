import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UnifiedNotification } from '$lib/types';

vi.mock('$lib/stores/toast.svelte', () => ({ showToast: vi.fn() }));
vi.mock('$lib/utils/storage', () => ({
  isTauri: () => false,
  getStorageItem: vi.fn().mockResolvedValue(null),
  setStorageItem: vi.fn().mockResolvedValue(undefined)
}));

import { addMuteRule, getMatchingMuteRule, isNotificationMuted } from './mute-rules.svelte';

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
    author: { login: 'dependabot', avatarUrl: 'https://example.com/a.png' },
    subjectState: null,
    ...overrides
  } as UnifiedNotification;
}

describe('getMatchingMuteRule / isNotificationMuted', () => {
  beforeEach(async () => {
    // Clear whatever rules a previous test added.
    const { getMuteRules, removeMuteRule } = await import('./mute-rules.svelte');
    for (const rule of [...getMuteRules()]) {
      await removeMuteRule(rule.id);
    }
  });

  it('returns null and false when no rule matches', () => {
    const n = notification({ repository: 'acme/quiet' });
    expect(getMatchingMuteRule(n)).toBeNull();
    expect(isNotificationMuted(n)).toBe(false);
  });

  it('matches a rule targeting the notification author', async () => {
    await addMuteRule({ author: 'dependabot' });
    const n = notification({ author: { login: 'dependabot', avatarUrl: 'x' } });

    expect(getMatchingMuteRule(n)?.author).toBe('dependabot');
    expect(isNotificationMuted(n)).toBe(true);
  });

  it('does not match a rule for a different author', async () => {
    await addMuteRule({ author: 'dependabot' });
    const n = notification({ author: { login: 'someone-else', avatarUrl: 'x' } });

    expect(getMatchingMuteRule(n)).toBeNull();
    expect(isNotificationMuted(n)).toBe(false);
  });

  it('requires every criterion on a multi-field rule to match', async () => {
    await addMuteRule({ project: 'acme/app', type: 'pull_request' });

    expect(isNotificationMuted(notification({ repository: 'acme/app', type: 'issue' }))).toBe(
      false
    );
    expect(
      isNotificationMuted(notification({ repository: 'acme/app', type: 'pull_request' }))
    ).toBe(true);
  });
});
