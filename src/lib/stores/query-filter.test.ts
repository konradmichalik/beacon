import { describe, it, expect } from 'vitest';
import type { UnifiedNotification } from '$lib/types';
import { updateFromBackend, getFilteredNotifications } from './notifications.svelte';

function notification(overrides: Partial<UnifiedNotification> = {}): UnifiedNotification {
  return {
    id: 'n1',
    source: 'github',
    type: 'pull_request',
    title: 'Something',
    repository: 'acme/app',
    url: 'https://github.com/acme/app/pull/1',
    reason: 'mention',
    unread: true,
    updatedAt: '2026-08-01T00:00:00Z',
    createdAt: '2026-08-01T00:00:00Z',
    author: null,
    subjectState: null,
    ...overrides
  } as UnifiedNotification;
}

describe('getFilteredNotifications query wiring', () => {
  it('applies a repo: qualifier through the full store', () => {
    updateFromBackend([
      notification({ id: 'a', repository: 'acme/app' }),
      notification({ id: 'b', repository: 'acme/other' })
    ]);

    const result = getFilteredNotifications(
      'all',
      null,
      'date',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'repo:acme/app'
    );
    expect(result.map((n) => n.id)).toEqual(['a']);
  });

  it('combines a query with the other active filters', () => {
    updateFromBackend([
      notification({ id: 'a', repository: 'acme/app', author: { login: 'bot', avatarUrl: '' } }),
      notification({ id: 'b', repository: 'acme/app', author: { login: 'human', avatarUrl: '' } })
    ]);

    const result = getFilteredNotifications(
      'all',
      null,
      'date',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '-author:bot'
    );
    expect(result.map((n) => n.id)).toEqual(['b']);
  });

  it('leaves the list untouched for an empty query', () => {
    updateFromBackend([notification({ id: 'a' }), notification({ id: 'b' })]);
    expect(getFilteredNotifications('all', null).map((n) => n.id)).toEqual(['a', 'b']);
  });
});
