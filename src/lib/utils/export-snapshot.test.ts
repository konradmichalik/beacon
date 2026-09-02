import { describe, it, expect } from 'vitest';
import { buildExportSnapshot } from './export-snapshot';
import type { ExportSnapshotInput } from './export-snapshot';
import type { UnifiedNotification, UnifiedPullRequest, UnifiedIssue } from '$lib/types';

function makeNotification(overrides: Partial<UnifiedNotification> = {}): UnifiedNotification {
  return {
    id: 'github-1',
    source: 'github',
    type: 'pull_request',
    title: 'Test notification',
    repository: 'owner/repo',
    url: 'https://github.com/owner/repo/pull/1',
    reason: 'review_requested',
    unread: true,
    updatedAt: '2026-09-02T10:00:00Z',
    createdAt: '2026-09-02T10:00:00Z',
    author: null,
    subjectState: 'open',
    ...overrides
  };
}

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
    createdAt: '2026-09-02T10:00:00Z',
    updatedAt: '2026-09-02T10:00:00Z',
    ciStatus: 'unknown',
    reviewDecision: null,
    mergeStatus: 'unknown',
    reviewRequestedFromMe: false,
    reviewedByMe: false,
    enrichment: 'pending',
    ...overrides
  };
}

function makeIssue(overrides: Partial<UnifiedIssue> = {}): UnifiedIssue {
  return {
    id: 'github-issue-1',
    source: 'github',
    title: 'Test issue',
    repository: 'owner/repo',
    url: 'https://github.com/owner/repo/issues/1',
    number: 1,
    author: null,
    createdAt: '2026-09-02T10:00:00Z',
    updatedAt: '2026-09-02T10:00:00Z',
    role: 'assigned',
    labels: [],
    ...overrides
  };
}

function makeInput(overrides: Partial<ExportSnapshotInput> = {}): ExportSnapshotInput {
  return {
    displayName: 'Beacon',
    ttlSeconds: 300,
    notificationsLoaded: true,
    filteredNotifications: [],
    prsLoaded: true,
    filteredPRs: [],
    issuesEnabled: false,
    issuesLoaded: false,
    filteredIssues: [],
    now: new Date('2026-09-02T12:00:00Z'),
    ...overrides
  };
}

describe('buildExportSnapshot', () => {
  it('returns null while notifications have not loaded yet', () => {
    expect(buildExportSnapshot(makeInput({ notificationsLoaded: false }))).toBeNull();
  });

  it('returns null while PRs have not loaded yet', () => {
    expect(buildExportSnapshot(makeInput({ prsLoaded: false }))).toBeNull();
  });

  it('returns null when issues are enabled but not yet loaded', () => {
    expect(buildExportSnapshot(makeInput({ issuesEnabled: true, issuesLoaded: false }))).toBeNull();
  });

  it('does not require issues to be loaded when the issues feature is disabled', () => {
    expect(
      buildExportSnapshot(makeInput({ issuesEnabled: false, issuesLoaded: false }))
    ).not.toBeNull();
  });

  it('produces schema v1 top-level fields', () => {
    const snapshot = buildExportSnapshot(makeInput());
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      app: 'beacon',
      displayName: 'Beacon',
      updatedAt: '2026-09-02T12:00:00.000Z',
      ttlSeconds: 300
    });
  });

  it('produces an idle unread view with no detail when there are no unread notifications', () => {
    const snapshot = buildExportSnapshot(makeInput({ filteredNotifications: [] }));
    const view = snapshot?.views.find((v) => v.id === 'unread');
    expect(view).toMatchObject({ id: 'unread', label: 'Inbox', value: '0', state: 'idle' });
    expect(view?.detail).toBeUndefined();
  });

  it('counts unread notifications and breaks the detail down by source', () => {
    const notifications = [
      makeNotification({ id: '1', source: 'github', unread: true }),
      makeNotification({ id: '2', source: 'github', unread: true }),
      makeNotification({ id: '3', source: 'gitlab', unread: true }),
      makeNotification({ id: '4', source: 'gitlab', unread: false })
    ];
    const snapshot = buildExportSnapshot(makeInput({ filteredNotifications: notifications }));
    const view = snapshot?.views.find((v) => v.id === 'unread');
    expect(view).toMatchObject({
      value: '3',
      detail: '2 GitHub, 1 GitLab',
      state: 'warn'
    });
  });

  it('only counts unread notifications from the already-filtered list handed in', () => {
    // The caller is responsible for applying the active filter bar state;
    // buildExportSnapshot must not see or need the excluded items.
    const notifications = [makeNotification({ id: '1', unread: true })];
    const snapshot = buildExportSnapshot(makeInput({ filteredNotifications: notifications }));
    expect(snapshot?.views.find((v) => v.id === 'unread')?.value).toBe('1');
  });

  it('produces an idle reviews view when no review is requested', () => {
    const snapshot = buildExportSnapshot(makeInput({ filteredPRs: [] }));
    const view = snapshot?.views.find((v) => v.id === 'reviews');
    expect(view).toMatchObject({ id: 'reviews', label: 'Review', value: '0', state: 'idle' });
    expect(view?.detail).toBeUndefined();
  });

  it('reports the oldest review-requested PR repository as detail, ok when fresh', () => {
    const prs = [
      makePR({
        id: '1',
        repository: 'owner/newer',
        reviewRequestedFromMe: true,
        createdAt: '2026-09-02T11:00:00Z'
      }),
      makePR({
        id: '2',
        repository: 'owner/older',
        reviewRequestedFromMe: true,
        createdAt: '2026-09-02T10:00:00Z'
      })
    ];
    const snapshot = buildExportSnapshot(makeInput({ filteredPRs: prs }));
    const view = snapshot?.views.find((v) => v.id === 'reviews');
    expect(view).toMatchObject({ value: '2', detail: 'owner/older', state: 'ok' });
  });

  it('warns when the oldest review request is older than 24 hours', () => {
    const prs = [
      makePR({
        id: '1',
        repository: 'owner/stale',
        reviewRequestedFromMe: true,
        createdAt: '2026-08-31T10:00:00Z' // ~50h before the fixed `now`
      })
    ];
    const snapshot = buildExportSnapshot(makeInput({ filteredPRs: prs }));
    expect(snapshot?.views.find((v) => v.id === 'reviews')).toMatchObject({ state: 'warn' });
  });

  it('excludes authored PRs from the reviews view', () => {
    const prs = [makePR({ reviewRequestedFromMe: false })];
    const snapshot = buildExportSnapshot(makeInput({ filteredPRs: prs }));
    expect(snapshot?.views.find((v) => v.id === 'reviews')?.value).toBe('0');
  });

  it('produces an idle mine view when the user has no PRs', () => {
    const snapshot = buildExportSnapshot(makeInput({ filteredPRs: [] }));
    const view = snapshot?.views.find((v) => v.id === 'mine');
    expect(view).toMatchObject({ id: 'mine', label: 'Mine', value: '0', state: 'idle' });
    expect(view?.detail).toBeUndefined();
  });

  it('reports failing and mergeable counts for own PRs, critical when CI failed', () => {
    const prs = [
      makePR({ id: '1', reviewRequestedFromMe: false, ciStatus: 'failure' }),
      makePR({ id: '2', reviewRequestedFromMe: false, mergeStatus: 'mergeable' }),
      makePR({ id: '3', reviewRequestedFromMe: false, mergeStatus: 'mergeable' })
    ];
    const snapshot = buildExportSnapshot(makeInput({ filteredPRs: prs }));
    expect(snapshot?.views.find((v) => v.id === 'mine')).toMatchObject({
      value: '3',
      detail: '1 red, 2 mergeable',
      state: 'critical'
    });
  });

  it('is ok for own PRs with no failing CI', () => {
    const prs = [makePR({ reviewRequestedFromMe: false, mergeStatus: 'mergeable' })];
    const snapshot = buildExportSnapshot(makeInput({ filteredPRs: prs }));
    expect(snapshot?.views.find((v) => v.id === 'mine')).toMatchObject({
      detail: '1 mergeable',
      state: 'ok'
    });
  });

  it('excludes the issues view when the issues feature is disabled', () => {
    const snapshot = buildExportSnapshot(makeInput({ issuesEnabled: false }));
    expect(snapshot?.views.find((v) => v.id === 'issues')).toBeUndefined();
  });

  it('includes an issues view with the assigned count when enabled', () => {
    const issues = [makeIssue({ id: '1' }), makeIssue({ id: '2' })];
    const snapshot = buildExportSnapshot(
      makeInput({ issuesEnabled: true, issuesLoaded: true, filteredIssues: issues })
    );
    expect(snapshot?.views.find((v) => v.id === 'issues')).toMatchObject({
      id: 'issues',
      label: 'Issues',
      value: '2',
      detail: 'assigned',
      state: 'ok'
    });
  });

  it('marks the issues view idle when there are no assigned issues', () => {
    const snapshot = buildExportSnapshot(
      makeInput({ issuesEnabled: true, issuesLoaded: true, filteredIssues: [] })
    );
    expect(snapshot?.views.find((v) => v.id === 'issues')).toMatchObject({
      value: '0',
      state: 'idle'
    });
  });

  it('always produces at least the three core views even when everything is empty', () => {
    const snapshot = buildExportSnapshot(makeInput());
    expect(snapshot?.views.map((v) => v.id)).toEqual(['unread', 'reviews', 'mine']);
  });
});
