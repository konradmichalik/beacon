import { describe, it, expect } from 'vitest';
import {
  syntheticNotificationId,
  syntheticNotificationPrId,
  isSyntheticNotification,
  buildSyntheticNotification
} from './synthetic-notifications';
import type { UnifiedPullRequest, UnifiedNotification } from '$lib/types';
import type { PRTransition } from './pr-transitions';

function makePR(overrides: Partial<UnifiedPullRequest> = {}): UnifiedPullRequest {
  return {
    id: 'github-pr-1',
    source: 'github',
    title: 'Test PR',
    repository: 'owner/repo',
    url: 'https://github.com/owner/repo/pull/1',
    number: 1,
    draft: false,
    author: { login: 'octocat', avatarUrl: 'https://example.com/a.png' },
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

describe('syntheticNotificationId', () => {
  it('namespaces the id so it cannot collide with a real github- or gitlab- id', () => {
    const id = syntheticNotificationId('ready_for_review', 'github-pr-123');
    expect(id).not.toMatch(/^github-/);
    expect(id).not.toMatch(/^gitlab-/);
  });

  it('is deterministic for the same kind and PR id', () => {
    const a = syntheticNotificationId('mergeable', 'gitlab-mr-456');
    const b = syntheticNotificationId('mergeable', 'gitlab-mr-456');
    expect(a).toBe(b);
  });

  it('differs between the two transition kinds for the same PR', () => {
    const ready = syntheticNotificationId('ready_for_review', 'github-pr-1');
    const mergeable = syntheticNotificationId('mergeable', 'github-pr-1');
    expect(ready).not.toBe(mergeable);
  });
});

describe('syntheticNotificationPrId', () => {
  it('recovers the original PR id from a synthetic notification id', () => {
    const id = syntheticNotificationId('ready_for_review', 'github-pr-123');
    expect(syntheticNotificationPrId(id)).toBe('github-pr-123');
  });

  it('round-trips for both transition kinds', () => {
    const mergeableId = syntheticNotificationId('mergeable', 'gitlab-mr-456');
    expect(syntheticNotificationPrId(mergeableId)).toBe('gitlab-mr-456');
  });
});

describe('isSyntheticNotification', () => {
  const base: UnifiedNotification = {
    id: 'github-1',
    source: 'github',
    type: 'pull_request',
    title: 't',
    repository: 'r',
    url: 'u',
    reason: 'review_requested',
    unread: true,
    updatedAt: '2026-03-17T12:00:00Z',
    createdAt: '2026-03-17T10:00:00Z',
    author: null,
    subjectState: 'open'
  };

  it('is true when the synthetic flag is set', () => {
    expect(isSyntheticNotification(base)).toBe(false);
    expect(isSyntheticNotification({ ...base, synthetic: true })).toBe(true);
  });

  it('is also true from the id alone, so a copy that lost the flag (e.g. stale persisted JSON) is still caught before it could reach a server-sync call', () => {
    expect(isSyntheticNotification({ ...base, id: 'beacon:pr-ready:github-pr-1' })).toBe(true);
  });
});

describe('buildSyntheticNotification', () => {
  it('maps a github PR ready_for_review transition to a pull_request notification', () => {
    const pr = makePR({ source: 'github', draft: false });
    const transition: PRTransition = { kind: 'ready_for_review', pr };
    const now = new Date('2026-03-18T09:00:00Z');

    const notification = buildSyntheticNotification(transition, now);

    expect(notification.id).toBe(syntheticNotificationId('ready_for_review', pr.id));
    expect(notification.type).toBe('pull_request');
    expect(notification.reason).toBe('ready_for_review');
    expect(notification.title).toBe(pr.title);
    expect(notification.repository).toBe(pr.repository);
    expect(notification.url).toBe(pr.url);
    expect(notification.author).toEqual(pr.author);
    expect(notification.subjectState).toBe('open');
    expect(notification.draft).toBe(false);
    expect(notification.unread).toBe(true);
    expect(notification.synthetic).toBe(true);
    expect(notification.updatedAt).toBe(now.toISOString());
    expect(notification.createdAt).toBe(pr.createdAt);
  });

  it('maps a gitlab PR mergeable transition to a merge_request notification', () => {
    const pr = makePR({ source: 'gitlab', mergeStatus: 'mergeable' });
    const transition: PRTransition = { kind: 'mergeable', pr };
    const now = new Date('2026-03-18T09:00:00Z');

    const notification = buildSyntheticNotification(transition, now);

    expect(notification.type).toBe('merge_request');
    expect(notification.reason).toBe('mergeable');
  });
});
