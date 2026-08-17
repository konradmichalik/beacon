import { describe, it, expect, vi } from 'vitest';
import type { UnifiedNotification } from '$lib/types';

vi.mock('./mute-rules.svelte', () => ({
  isNotificationMuted: (n: UnifiedNotification) => n.repository === 'acme/noisy'
}));
vi.mock('./snooze.svelte', () => ({
  isSnoozed: (n: UnifiedNotification) => n.id === 'snoozed-1'
}));

import { updateFromBackend, getHiddenCount } from './notifications.svelte';

function notification(overrides: Partial<UnifiedNotification> = {}): UnifiedNotification {
  return {
    id: 'n1',
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

describe('getHiddenCount', () => {
  it('counts both muted and snoozed items within scope', () => {
    updateFromBackend([
      notification({ id: 'visible-1' }),
      notification({ id: 'muted-1', repository: 'acme/noisy' }),
      notification({ id: 'snoozed-1' })
    ]);

    expect(getHiddenCount('all', null)).toBe(2);
  });

  it('is 0 when nothing is hidden', () => {
    updateFromBackend([notification({ id: 'visible-only' })]);
    expect(getHiddenCount('all', null)).toBe(0);
  });

  it('is scoped to the active source filter', () => {
    updateFromBackend([
      notification({ id: 'gh-muted', repository: 'acme/noisy', source: 'github' }),
      notification({ id: 'gl-muted', repository: 'acme/noisy', source: 'gitlab' })
    ]);

    expect(getHiddenCount('github', null)).toBe(1);
    expect(getHiddenCount('gitlab', null)).toBe(1);
  });

  it('is scoped to the active project filter', () => {
    updateFromBackend([
      notification({ id: 'a', repository: 'acme/noisy' }),
      notification({ id: 'b', repository: 'acme/other-noisy' })
    ]);

    expect(getHiddenCount('all', 'acme/noisy')).toBe(1);
  });
});
