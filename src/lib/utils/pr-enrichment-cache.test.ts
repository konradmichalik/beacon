import { describe, it, expect } from 'vitest';
import { mergeCachedEnrichment } from './pr-enrichment-cache';
import type { UnifiedPullRequest } from '$lib/types';

function makePR(overrides: Partial<UnifiedPullRequest> = {}): UnifiedPullRequest {
  return {
    id: 'github-pr-1',
    source: 'github',
    title: 'Test PR',
    repository: 'owner/repo',
    url: 'https://github.com/owner/repo/pull/1',
    number: 1,
    draft: false,
    author: null,
    createdAt: '2026-03-17T10:00:00Z',
    updatedAt: '2026-03-17T12:00:00Z',
    ciStatus: 'unknown',
    reviewDecision: null,
    mergeStatus: 'unknown',
    reviewRequestedFromMe: false,
    reviewedByMe: false,
    enrichment: 'pending',
    ...overrides
  };
}

describe('mergeCachedEnrichment', () => {
  it('carries the merge status over, since GitHub only learns it during enrichment', () => {
    const previous = [makePR({ enrichment: 'enriched', mergeStatus: 'mergeable' })];
    const fresh = [makePR({ enrichment: 'pending', mergeStatus: 'unknown' })];

    const merged = mergeCachedEnrichment(fresh, previous);

    expect(merged[0].mergeStatus).toBe('mergeable');
  });

  it('does not restore a cached mergeable for GitLab, whose transient states map to unknown', () => {
    const previous = [
      makePR({ source: 'gitlab', enrichment: 'enriched', mergeStatus: 'mergeable' })
    ];
    const fresh = [makePR({ source: 'gitlab', enrichment: 'pending', mergeStatus: 'unknown' })];

    const merged = mergeCachedEnrichment(fresh, previous);

    expect(merged[0].mergeStatus).toBe('unknown');
  });

  it('keeps a fresh merge status, since GitLab delivers it in the list response', () => {
    const previous = [
      makePR({ source: 'gitlab', enrichment: 'enriched', mergeStatus: 'mergeable' })
    ];
    const fresh = [makePR({ source: 'gitlab', enrichment: 'pending', mergeStatus: 'blocked' })];

    const merged = mergeCachedEnrichment(fresh, previous);

    expect(merged[0].mergeStatus).toBe('blocked');
  });

  it('reuses enriched fields when id and updatedAt match', () => {
    const previous = [
      makePR({
        enrichment: 'enriched',
        ciStatus: 'success',
        reviewDecision: 'approved',
        baseBranch: 'main'
      })
    ];
    const fresh = [makePR({ enrichment: 'pending' })];

    const merged = mergeCachedEnrichment(fresh, previous);
    expect(merged[0].enrichment).toBe('enriched');
    expect(merged[0].ciStatus).toBe('success');
    expect(merged[0].reviewDecision).toBe('approved');
    expect(merged[0].baseBranch).toBe('main');
  });

  it('does not reuse when updatedAt changed', () => {
    const previous = [makePR({ enrichment: 'enriched', ciStatus: 'success' })];
    const fresh = [makePR({ enrichment: 'pending', updatedAt: '2026-03-18T09:00:00Z' })];

    const merged = mergeCachedEnrichment(fresh, previous);
    expect(merged[0].enrichment).toBe('pending');
    expect(merged[0].ciStatus).toBe('unknown');
  });

  it('does not reuse when the cached entry was not enriched', () => {
    const previous = [makePR({ enrichment: 'skipped', ciStatus: 'success' })];
    const fresh = [makePR({ enrichment: 'pending' })];

    const merged = mergeCachedEnrichment(fresh, previous);
    expect(merged[0].enrichment).toBe('pending');
  });

  it('leaves a brand-new PR untouched', () => {
    const previous = [makePR({ id: 'github-pr-1', enrichment: 'enriched' })];
    const fresh = [makePR({ id: 'github-pr-2', enrichment: 'pending' })];

    const merged = mergeCachedEnrichment(fresh, previous);
    expect(merged[0].enrichment).toBe('pending');
  });

  it('keeps fresh base fields when carrying enrichment over', () => {
    const previous = [
      makePR({ enrichment: 'enriched', ciStatus: 'success', reviewRequestedFromMe: false })
    ];
    // Same PR, unchanged updatedAt, but now surfaced via the review-requested bucket.
    const fresh = [
      makePR({ enrichment: 'pending', reviewRequestedFromMe: true, title: 'Renamed' })
    ];

    const merged = mergeCachedEnrichment(fresh, previous);
    expect(merged[0].ciStatus).toBe('success'); // carried over
    expect(merged[0].reviewRequestedFromMe).toBe(true); // kept fresh
    expect(merged[0].title).toBe('Renamed'); // kept fresh
  });

  it('carries the failing check over across a poll for an unchanged PR', () => {
    const previous = [
      makePR({
        enrichment: 'enriched',
        ciStatus: 'failure',
        failingCheck: { name: 'test', url: 'https://x/1' }
      })
    ];
    const fresh = [makePR({ enrichment: 'pending' })];

    const merged = mergeCachedEnrichment(fresh, previous);
    expect(merged[0].failingCheck).toEqual({ name: 'test', url: 'https://x/1' });
  });

  it('drops the failing check when the PR changed and needs re-enrichment', () => {
    const previous = [
      makePR({
        enrichment: 'enriched',
        ciStatus: 'failure',
        failingCheck: { name: 'test', url: 'https://x/1' }
      })
    ];
    const fresh = [makePR({ enrichment: 'pending', updatedAt: '2026-03-18T09:00:00Z' })];

    const merged = mergeCachedEnrichment(fresh, previous);
    expect(merged[0].failingCheck).toBeUndefined();
  });

  it('handles empty inputs', () => {
    expect(mergeCachedEnrichment([], [])).toEqual([]);
    const fresh = [makePR()];
    expect(mergeCachedEnrichment(fresh, [])).toEqual(fresh);
  });
});
