import { describe, it, expect } from 'vitest';
import type { UnifiedPullRequest } from '$lib/types';
import { filterAndSortPRs, countPRsByMerge } from './pull-requests.svelte';

function pr(overrides: Partial<UnifiedPullRequest>): UnifiedPullRequest {
  return {
    id: 'pr-1',
    source: 'github',
    repository: 'acme/app',
    mergeStatus: 'blocked',
    updatedAt: '2026-08-01T10:00:00Z',
    createdAt: '2026-08-01T10:00:00Z',
    ...overrides
  } as UnifiedPullRequest;
}

describe('merge filter', () => {
  const prs = [
    pr({ id: 'a', mergeStatus: 'mergeable' }),
    pr({ id: 'b', mergeStatus: 'blocked' }),
    pr({ id: 'c', mergeStatus: 'unknown' }),
    pr({ id: 'd', mergeStatus: 'mergeable' })
  ];

  it('keeps every PR when the filter is off', () => {
    expect(filterAndSortPRs(prs, { merge: 'all' })).toHaveLength(4);
  });

  it('keeps only mergeable PRs when the filter is on', () => {
    const result = filterAndSortPRs(prs, { merge: 'mergeable' });
    expect(result.map((p) => p.id)).toEqual(['a', 'd']);
  });

  it('drops PRs whose merge status is not known yet', () => {
    const result = filterAndSortPRs([pr({ id: 'c', mergeStatus: 'unknown' })], {
      merge: 'mergeable'
    });
    expect(result).toEqual([]);
  });

  it('combines with the other filters instead of replacing them', () => {
    const mixed = [
      pr({ id: 'a', mergeStatus: 'mergeable', source: 'github' }),
      pr({ id: 'b', mergeStatus: 'mergeable', source: 'gitlab' })
    ];
    const result = filterAndSortPRs(mixed, { merge: 'mergeable', source: 'gitlab' });
    expect(result.map((p) => p.id)).toEqual(['b']);
  });
});

describe('countPRsByMerge', () => {
  it('counts mergeable PRs', () => {
    const counts = countPRsByMerge([
      pr({ id: 'a', mergeStatus: 'mergeable' }),
      pr({ id: 'b', mergeStatus: 'blocked' }),
      pr({ id: 'c', mergeStatus: 'mergeable' })
    ]);
    expect(counts.get('mergeable')).toBe(2);
  });

  it('reports no count when nothing is mergeable', () => {
    const counts = countPRsByMerge([pr({ id: 'a', mergeStatus: 'unknown' })]);
    expect(counts.get('mergeable')).toBeUndefined();
  });
});
