import { describe, it, expect } from 'vitest';
import { getAttentionState } from './pr-attention';
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
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-17T10:00:00Z',
    ciStatus: 'unknown',
    reviewDecision: null,
    reviewRequestedFromMe: false,
    reviewedByMe: false,
    enrichment: 'enriched',
    ...overrides
  };
}

const NOW = new Date('2026-08-17T12:00:00Z');

describe('getAttentionState', () => {
  it('is "none" while enrichment is still pending, even if fields look urgent', () => {
    const pr = makePR({
      enrichment: 'pending',
      ciStatus: 'failure',
      reviewDecision: 'changes_requested'
    });
    expect(getAttentionState(pr, 7, NOW)).toBe('none');
  });

  it('is "blocked" when changes were requested on a PR the user authored', () => {
    const pr = makePR({ reviewRequestedFromMe: false, reviewDecision: 'changes_requested' });
    expect(getAttentionState(pr, 7, NOW)).toBe('blocked');
  });

  it('is not "blocked" for changes requested on a PR the user is only reviewing', () => {
    const pr = makePR({ reviewRequestedFromMe: true, reviewDecision: 'changes_requested' });
    expect(getAttentionState(pr, 7, NOW)).not.toBe('blocked');
  });

  it('is "failing" when CI failed', () => {
    const pr = makePR({ ciStatus: 'failure' });
    expect(getAttentionState(pr, 7, NOW)).toBe('failing');
  });

  it('prioritizes "blocked" over "failing" when both apply', () => {
    const pr = makePR({
      reviewRequestedFromMe: false,
      reviewDecision: 'changes_requested',
      ciStatus: 'failure'
    });
    expect(getAttentionState(pr, 7, NOW)).toBe('blocked');
  });

  it('is "ready" when approved, CI passed, and not a draft', () => {
    const pr = makePR({ reviewDecision: 'approved', ciStatus: 'success', draft: false });
    expect(getAttentionState(pr, 7, NOW)).toBe('ready');
  });

  it('is not "ready" for an approved, passing draft', () => {
    const pr = makePR({ reviewDecision: 'approved', ciStatus: 'success', draft: true });
    expect(getAttentionState(pr, 7, NOW)).not.toBe('ready');
  });

  it('is "stale" just past the threshold', () => {
    const pr = makePR({ updatedAt: '2026-08-10T11:59:00Z' }); // just over 7 days before NOW
    expect(getAttentionState(pr, 7, NOW)).toBe('stale');
  });

  it('is not "stale" just under the threshold', () => {
    const pr = makePR({ updatedAt: '2026-08-10T12:30:00Z' }); // just under 7 days before NOW
    expect(getAttentionState(pr, 7, NOW)).toBe('none');
  });

  it('drafts never count as stale', () => {
    const pr = makePR({ updatedAt: '2026-01-01T00:00:00Z', draft: true });
    expect(getAttentionState(pr, 7, NOW)).not.toBe('stale');
  });

  it('respects a custom stale threshold', () => {
    const pr = makePR({ updatedAt: '2026-08-16T12:00:00Z' }); // 1 day before NOW
    expect(getAttentionState(pr, 1, NOW)).toBe('none');
    expect(getAttentionState(pr, 0, NOW)).toBe('stale');
  });

  it('is "none" for a fresh PR with no CI, review, or age signal', () => {
    const pr = makePR({ updatedAt: '2026-08-17T11:00:00Z' });
    expect(getAttentionState(pr, 7, NOW)).toBe('none');
  });
});
