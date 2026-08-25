import { describe, it, expect } from 'vitest';
import type { UnifiedNotification } from '$lib/types';
import { parseFilterQuery, matchesFilterTokens, filterByQuery } from './filter-tokens';

function notification(overrides: Partial<UnifiedNotification>): UnifiedNotification {
  return {
    id: 'n-1',
    source: 'github',
    type: 'pull_request',
    title: 'Add qualifier tokens to the filter bar',
    repository: 'konradmichalik/beacon',
    url: 'https://github.com/konradmichalik/beacon/issues/101',
    reason: 'mention',
    unread: true,
    updatedAt: '2026-08-25T10:00:00Z',
    createdAt: '2026-08-25T10:00:00Z',
    author: { login: 'konradmichalik', avatarUrl: '' },
    subjectState: 'open',
    ...overrides
  } as UnifiedNotification;
}

describe('parseFilterQuery', () => {
  it('parses qualifier tokens', () => {
    expect(parseFilterQuery('repo:konradmichalik/beacon')).toEqual([
      { negate: false, kind: 'repo', value: 'konradmichalik/beacon' }
    ]);
  });

  it('parses a leading dash as negation', () => {
    expect(parseFilterQuery('-author:dependabot')).toEqual([
      { negate: true, kind: 'author', value: 'dependabot' }
    ]);
  });

  it('treats bare words as text tokens', () => {
    expect(parseFilterQuery('qualifier')).toEqual([
      { negate: false, kind: 'text', value: 'qualifier' }
    ]);
  });

  it('falls back to a text token for an unknown qualifier key', () => {
    expect(parseFilterQuery('foo:bar')).toEqual([
      { negate: false, kind: 'text', value: 'foo:bar' }
    ]);
  });

  it('splits multiple tokens on whitespace', () => {
    expect(parseFilterQuery('repo:a/b -author:bot filter bar')).toEqual([
      { negate: false, kind: 'repo', value: 'a/b' },
      { negate: true, kind: 'author', value: 'bot' },
      { negate: false, kind: 'text', value: 'filter' },
      { negate: false, kind: 'text', value: 'bar' }
    ]);
  });
});

describe('matchesFilterTokens', () => {
  it('matches on repo', () => {
    const n = notification({ repository: 'konradmichalik/beacon' });
    expect(matchesFilterTokens(n, parseFilterQuery('repo:konradmichalik/beacon'))).toBe(true);
    expect(matchesFilterTokens(n, parseFilterQuery('repo:other/repo'))).toBe(false);
  });

  it('matches on org (the repository owner segment)', () => {
    const n = notification({ repository: 'konradmichalik/beacon' });
    expect(matchesFilterTokens(n, parseFilterQuery('org:konradmichalik'))).toBe(true);
    expect(matchesFilterTokens(n, parseFilterQuery('org:someone-else'))).toBe(false);
  });

  it('matches on author login', () => {
    const n = notification({ author: { login: 'dependabot', avatarUrl: '' } });
    expect(matchesFilterTokens(n, parseFilterQuery('author:dependabot'))).toBe(true);
  });

  it('excludes on a negated author token', () => {
    const n = notification({ author: { login: 'dependabot', avatarUrl: '' } });
    expect(matchesFilterTokens(n, parseFilterQuery('-author:dependabot'))).toBe(false);
  });

  it('never matches an author qualifier when there is no author', () => {
    const n = notification({ author: null });
    expect(matchesFilterTokens(n, parseFilterQuery('author:dependabot'))).toBe(false);
  });

  it('resolves the pr/mr aliases for type', () => {
    const pr = notification({ type: 'pull_request' });
    const mr = notification({ type: 'merge_request' });
    expect(matchesFilterTokens(pr, parseFilterQuery('type:pr'))).toBe(true);
    expect(matchesFilterTokens(pr, parseFilterQuery('type:mr'))).toBe(false);
    expect(matchesFilterTokens(mr, parseFilterQuery('type:mr'))).toBe(true);
  });

  it('matches plain text as a case-insensitive title substring', () => {
    const n = notification({ title: 'Qualifier tokens in the filter bar' });
    expect(matchesFilterTokens(n, parseFilterQuery('QUALIFIER'))).toBe(true);
    expect(matchesFilterTokens(n, parseFilterQuery('unrelated'))).toBe(false);
  });

  it('combines multiple tokens with AND', () => {
    const n = notification({ repository: 'konradmichalik/beacon', title: 'Fix the bug' });
    expect(matchesFilterTokens(n, parseFilterQuery('repo:konradmichalik/beacon bug'))).toBe(true);
    expect(matchesFilterTokens(n, parseFilterQuery('repo:konradmichalik/beacon feature'))).toBe(
      false
    );
  });
});

describe('filterByQuery', () => {
  it('returns every notification for an empty query', () => {
    const items = [notification({ id: 'a' }), notification({ id: 'b' })];
    expect(filterByQuery(items, '')).toHaveLength(2);
  });

  it('filters down to matching notifications', () => {
    const items = [
      notification({ id: 'a', author: { login: 'dependabot', avatarUrl: '' } }),
      notification({ id: 'b', author: { login: 'konradmichalik', avatarUrl: '' } })
    ];
    expect(filterByQuery(items, '-author:dependabot').map((n) => n.id)).toEqual(['b']);
  });
});
