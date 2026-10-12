import { describe, it, expect } from 'vitest';
import { matchesMuteCriteria, countMuteMatches } from './mute-match';
import type { UnifiedNotification } from '$lib/types';

function makeNotification(overrides: Partial<UnifiedNotification> = {}): UnifiedNotification {
  return {
    id: 'n1',
    source: 'github',
    type: 'pull_request',
    title: 'Test',
    repository: 'owner/repo',
    url: 'https://github.com/owner/repo/pull/1',
    reason: 'subscribed',
    unread: true,
    updatedAt: '2026-08-17T10:00:00Z',
    createdAt: '2026-08-17T09:00:00Z',
    author: { login: 'octo', avatarUrl: '' },
    subjectState: 'open',
    ...overrides
  };
}

describe('matchesMuteCriteria', () => {
  it('matches when every given criterion matches', () => {
    const n = makeNotification();
    expect(matchesMuteCriteria({ project: 'owner/repo', type: 'pull_request' }, n)).toBe(true);
  });

  it('does not match when one criterion differs', () => {
    const n = makeNotification();
    expect(matchesMuteCriteria({ project: 'owner/repo', type: 'issue' }, n)).toBe(false);
    expect(matchesMuteCriteria({ author: 'someone-else' }, n)).toBe(false);
    expect(matchesMuteCriteria({ status: 'merged' }, n)).toBe(false);
  });

  it('ignores criteria that are not set', () => {
    expect(matchesMuteCriteria({ author: 'octo' }, makeNotification())).toBe(true);
  });

  it('does not match an author criterion against a notification without author', () => {
    expect(matchesMuteCriteria({ author: 'octo' }, makeNotification({ author: null }))).toBe(false);
  });
});

describe('countMuteMatches', () => {
  it('counts only the notifications a rule would hide', () => {
    const items = [
      makeNotification({ id: 'a' }),
      makeNotification({ id: 'b', repository: 'owner/other' }),
      makeNotification({ id: 'c' })
    ];
    expect(countMuteMatches({ project: 'owner/repo' }, items)).toBe(2);
  });

  it('is zero for an empty list', () => {
    expect(countMuteMatches({ project: 'owner/repo' }, [])).toBe(0);
  });
});
