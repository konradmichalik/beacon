import { describe, it, expect } from 'vitest';
import { detectPRTransitions } from './pr-transitions';
import type { UnifiedPullRequest } from '$lib/types';
import type { PRStateSnapshot } from './pr-transitions';

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

describe('detectPRTransitions', () => {
  it('never fires on the first observation of a PR, even if already ready', () => {
    const pr = makePR({ draft: false, reviewRequestedFromMe: true });
    const { transitions } = detectPRTransitions([pr], new Map());
    expect(transitions).toEqual([]);
  });

  it('never fires on the first observation of a PR, even if already mergeable', () => {
    const pr = makePR({ mergeStatus: 'mergeable', reviewRequestedFromMe: false });
    const { transitions } = detectPRTransitions([pr], new Map());
    expect(transitions).toEqual([]);
  });

  it('fires ready_for_review when draft flips to false for a review-requested PR', () => {
    const baseline = new Map<string, PRStateSnapshot>([
      ['github-pr-1', { draft: true, mergeStatus: 'unknown' }]
    ]);
    const pr = makePR({ draft: false, reviewRequestedFromMe: true });

    const { transitions } = detectPRTransitions([pr], baseline);

    expect(transitions).toEqual([{ kind: 'ready_for_review', pr }]);
  });

  it('does not fire ready_for_review for a PR I authored myself', () => {
    const baseline = new Map<string, PRStateSnapshot>([
      ['github-pr-1', { draft: true, mergeStatus: 'unknown' }]
    ]);
    const pr = makePR({ draft: false, reviewRequestedFromMe: false });

    const { transitions } = detectPRTransitions([pr], baseline);

    expect(transitions).toEqual([]);
  });

  it('is silent again on the next poll once already fired', () => {
    const baseline = new Map<string, PRStateSnapshot>([
      ['github-pr-1', { draft: true, mergeStatus: 'unknown' }]
    ]);
    const pr = makePR({ draft: false, reviewRequestedFromMe: true });

    const first = detectPRTransitions([pr], baseline);
    const second = detectPRTransitions([pr], first.baseline);

    expect(second.transitions).toEqual([]);
  });

  it('fires mergeable when mergeStatus flips from blocked to mergeable for the author', () => {
    const baseline = new Map<string, PRStateSnapshot>([
      ['github-pr-1', { draft: false, mergeStatus: 'blocked' }]
    ]);
    const pr = makePR({ mergeStatus: 'mergeable', reviewRequestedFromMe: false });

    const { transitions } = detectPRTransitions([pr], baseline);

    expect(transitions).toEqual([{ kind: 'mergeable', pr }]);
  });

  it('does not fire mergeable for a PR I am only reviewing, not authoring', () => {
    const baseline = new Map<string, PRStateSnapshot>([
      ['github-pr-1', { draft: false, mergeStatus: 'blocked' }]
    ]);
    const pr = makePR({ mergeStatus: 'mergeable', reviewRequestedFromMe: true });

    const { transitions } = detectPRTransitions([pr], baseline);

    expect(transitions).toEqual([]);
  });

  it('never fires when mergeStatus goes from unknown to mergeable', () => {
    const baseline = new Map<string, PRStateSnapshot>([
      ['github-pr-1', { draft: false, mergeStatus: 'unknown' }]
    ]);
    const pr = makePR({ mergeStatus: 'mergeable', reviewRequestedFromMe: false });

    const { transitions } = detectPRTransitions([pr], baseline);

    expect(transitions).toEqual([]);
  });

  it('does not let a transient unknown erase a remembered blocked status', () => {
    const baseline = new Map<string, PRStateSnapshot>([
      ['github-pr-1', { draft: false, mergeStatus: 'blocked' }]
    ]);
    const unknownPoll = makePR({ mergeStatus: 'unknown', reviewRequestedFromMe: false });
    const mergeablePoll = makePR({ mergeStatus: 'mergeable', reviewRequestedFromMe: false });

    const afterUnknown = detectPRTransitions([unknownPoll], baseline);
    expect(afterUnknown.transitions).toEqual([]);

    const afterMergeable = detectPRTransitions([mergeablePoll], afterUnknown.baseline);
    expect(afterMergeable.transitions).toEqual([{ kind: 'mergeable', pr: mergeablePoll }]);
  });

  it('does not also fire mergeable right after ready_for_review once enrichment lands', () => {
    const baseline = new Map<string, PRStateSnapshot>([
      ['github-pr-1', { draft: true, mergeStatus: 'blocked' }]
    ]);
    const readyPoll = makePR({
      draft: false,
      mergeStatus: 'blocked',
      reviewRequestedFromMe: true
    });

    const afterReady = detectPRTransitions([readyPoll], baseline);
    expect(afterReady.transitions).toEqual([{ kind: 'ready_for_review', pr: readyPoll }]);

    const enrichedPoll = makePR({
      draft: false,
      mergeStatus: 'mergeable',
      reviewRequestedFromMe: true
    });
    const afterEnriched = detectPRTransitions([enrichedPoll], afterReady.baseline);
    expect(afterEnriched.transitions).toEqual([]);
  });

  it('does not fire mergeable for the author right after their own draft flip, once enrichment lands', () => {
    const baseline = new Map<string, PRStateSnapshot>([
      ['github-pr-1', { draft: true, mergeStatus: 'blocked' }]
    ]);
    // Authored by me (reviewRequestedFromMe: false), so only the mergeable
    // branch is reachable for this PR — the draft flip itself must still
    // reset the remembered mergeStatus, or the later enrichment poll looks
    // like an independent blocked -> mergeable transition.
    const readyPoll = makePR({
      draft: false,
      mergeStatus: 'blocked',
      reviewRequestedFromMe: false
    });
    const afterReady = detectPRTransitions([readyPoll], baseline);
    expect(afterReady.transitions).toEqual([]);

    const enrichedPoll = makePR({
      draft: false,
      mergeStatus: 'mergeable',
      reviewRequestedFromMe: false
    });
    const afterEnriched = detectPRTransitions([enrichedPoll], afterReady.baseline);
    expect(afterEnriched.transitions).toEqual([]);
  });

  it('fires ready_for_review again after going ready, back to draft, then ready', () => {
    const baseline = new Map<string, PRStateSnapshot>([
      ['github-pr-1', { draft: true, mergeStatus: 'unknown' }]
    ]);
    const readyPoll = makePR({ draft: false, reviewRequestedFromMe: true });
    const afterFirstReady = detectPRTransitions([readyPoll], baseline);
    expect(afterFirstReady.transitions).toHaveLength(1);

    const draftAgainPoll = makePR({ draft: true, reviewRequestedFromMe: true });
    const afterDraftAgain = detectPRTransitions([draftAgainPoll], afterFirstReady.baseline);
    expect(afterDraftAgain.transitions).toEqual([]);

    const readyAgainPoll = makePR({ draft: false, reviewRequestedFromMe: true });
    const afterSecondReady = detectPRTransitions([readyAgainPoll], afterDraftAgain.baseline);
    expect(afterSecondReady.transitions).toEqual([
      { kind: 'ready_for_review', pr: readyAgainPoll }
    ]);
  });

  it('drops a PR from the returned baseline once it is no longer in the fresh list', () => {
    const baseline = new Map<string, PRStateSnapshot>([
      ['github-pr-1', { draft: false, mergeStatus: 'blocked' }]
    ]);

    const { baseline: nextBaseline } = detectPRTransitions([], baseline);

    expect(nextBaseline.has('github-pr-1')).toBe(false);
  });

  it('does not mutate the baseline map passed in', () => {
    const baseline = new Map<string, PRStateSnapshot>([
      ['github-pr-1', { draft: true, mergeStatus: 'unknown' }]
    ]);
    const pr = makePR({ draft: false, reviewRequestedFromMe: true });

    detectPRTransitions([pr], baseline);

    expect(baseline.get('github-pr-1')).toEqual({ draft: true, mergeStatus: 'unknown' });
  });
});
