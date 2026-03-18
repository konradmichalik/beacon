import { describe, it, expect } from 'vitest';
import { mapSubjectType, buildHtmlUrl } from './github/client';
import { mapTargetType, mapActionToReason, mapTargetState } from './gitlab/client';
import {
  mapCIStatus as ghMapCIStatus,
  mapReviewDecision as ghMapReviewDecision,
  hasUserReviewed,
  repoFromUrl,
  type GitHubCheckRun,
  type GitHubReview
} from './github/pull-requests';
import {
  mapCIStatus as glMapCIStatus,
  mapReviewDecision as glMapReviewDecision,
  hasUserApproved
} from './gitlab/pull-requests';
import type { GitHubNotification } from '$lib/types';

// ── GitHub Notification Mapping ───────────────────────────────

describe('GitHub: mapSubjectType', () => {
  it.each([
    ['Issue', 'issue'],
    ['PullRequest', 'pull_request'],
    ['Release', 'release'],
    ['Discussion', 'discussion'],
    ['CheckSuite', 'other'],
    ['SomethingNew', 'other']
  ])('maps "%s" to "%s"', (input, expected) => {
    expect(mapSubjectType(input)).toBe(expected);
  });
});

describe('GitHub: buildHtmlUrl', () => {
  const baseNotification: GitHubNotification = {
    id: '1',
    unread: true,
    reason: 'review_requested',
    updated_at: '2026-03-17T12:00:00Z',
    subject: {
      title: 'Test PR',
      url: 'https://api.github.com/repos/owner/repo/pulls/42',
      type: 'PullRequest',
      latest_comment_url: null
    },
    repository: {
      full_name: 'owner/repo',
      html_url: 'https://github.com/owner/repo',
      owner: { login: 'owner', avatar_url: 'https://example.com/avatar.png' }
    }
  };

  it('converts pulls API URL to /pull/ HTML URL', () => {
    expect(buildHtmlUrl(baseNotification)).toBe('https://github.com/owner/repo/pull/42');
  });

  it('converts issues API URL to /issues/ HTML URL', () => {
    const notification = {
      ...baseNotification,
      subject: {
        ...baseNotification.subject,
        url: 'https://api.github.com/repos/owner/repo/issues/7'
      }
    };
    expect(buildHtmlUrl(notification)).toBe('https://github.com/owner/repo/issues/7');
  });

  it('falls back to repository URL when subject URL is null', () => {
    const notification = {
      ...baseNotification,
      subject: { ...baseNotification.subject, url: null }
    };
    expect(buildHtmlUrl(notification)).toBe('https://github.com/owner/repo');
  });

  it('falls back to repository URL for unknown API paths', () => {
    const notification = {
      ...baseNotification,
      subject: {
        ...baseNotification.subject,
        url: 'https://api.github.com/repos/owner/repo/releases/99'
      }
    };
    expect(buildHtmlUrl(notification)).toBe('https://github.com/owner/repo');
  });
});

// ── GitLab Notification Mapping ───────────────────────────────

describe('GitLab: mapTargetType', () => {
  it.each([
    ['Issue', 'issue'],
    ['MergeRequest', 'merge_request'],
    ['Pipeline', 'pipeline'],
    ['Epic', 'other']
  ])('maps "%s" to "%s"', (input, expected) => {
    expect(mapTargetType(input)).toBe(expected);
  });
});

describe('GitLab: mapActionToReason', () => {
  it.each([
    ['assigned', '', 'assign'],
    ['mentioned', '', 'mention'],
    ['directly_addressed', '', 'mention'],
    ['build_failed', '', 'ci_activity'],
    ['review_requested', '', 'review_requested'],
    ['marked', '', 'review_requested'],
    ['approval_required', '', 'approval_requested'],
    ['approved', '', 'approved'],
    ['unmergeable', '', 'unmergeable'],
    ['merge_train_removed', '', 'merge_train_removed'],
    ['member_access_requested', '', 'member_access_requested'],
    ['change_requested', '', 'change_requested']
  ])('maps action "%s" to reason "%s"', (action, body, expected) => {
    expect(mapActionToReason(action, body)).toBe(expected);
  });

  it('maps review_submitted with empty body to "approved"', () => {
    expect(mapActionToReason('review_submitted', '')).toBe('approved');
    expect(mapActionToReason('review_submitted', '  ')).toBe('approved');
  });

  it('maps review_submitted mentioning changes to "change_requested"', () => {
    expect(mapActionToReason('review_submitted', 'Requested changes on line 5')).toBe(
      'change_requested'
    );
  });

  it('maps review_submitted with other body to "review_submitted"', () => {
    expect(mapActionToReason('review_submitted', 'Looks good overall')).toBe('review_submitted');
  });

  it('passes through unknown actions', () => {
    expect(mapActionToReason('some_new_action', '')).toBe('some_new_action');
  });
});

describe('GitLab: mapTargetState', () => {
  it.each([
    ['merged', 'merged'],
    ['closed', 'closed'],
    ['opened', 'open'],
    [undefined, null]
  ])('maps state "%s" to "%s"', (input, expected) => {
    expect(mapTargetState(input)).toBe(expected);
  });
});

// ── GitHub PR Mapping ─────────────────────────────────────────

describe('GitHub PR: repoFromUrl', () => {
  it('extracts owner/repo from API URL', () => {
    expect(repoFromUrl('https://api.github.com/repos/facebook/react')).toBe('facebook/react');
  });
});

describe('GitHub PR: mapCIStatus', () => {
  it('returns "unknown" for empty runs', () => {
    expect(ghMapCIStatus([])).toBe('unknown');
  });

  it('returns "pending" when any run is not completed', () => {
    const runs: GitHubCheckRun[] = [
      { status: 'completed', conclusion: 'success' },
      { status: 'in_progress', conclusion: null }
    ];
    expect(ghMapCIStatus(runs)).toBe('pending');
  });

  it('returns "success" when all completed with success/skipped', () => {
    const runs: GitHubCheckRun[] = [
      { status: 'completed', conclusion: 'success' },
      { status: 'completed', conclusion: 'skipped' }
    ];
    expect(ghMapCIStatus(runs)).toBe('success');
  });

  it('returns "failure" when any run failed', () => {
    const runs: GitHubCheckRun[] = [
      { status: 'completed', conclusion: 'success' },
      { status: 'completed', conclusion: 'failure' }
    ];
    expect(ghMapCIStatus(runs)).toBe('failure');
  });
});

describe('GitHub PR: mapReviewDecision', () => {
  it('returns "review_required" for no reviews', () => {
    expect(ghMapReviewDecision([])).toBe('review_required');
  });

  it('returns "changes_requested" when present', () => {
    const reviews: GitHubReview[] = [
      { state: 'APPROVED', user: { login: 'alice' } },
      { state: 'CHANGES_REQUESTED', user: { login: 'bob' } }
    ];
    expect(ghMapReviewDecision(reviews)).toBe('changes_requested');
  });

  it('returns "approved" when approved without changes requested', () => {
    const reviews: GitHubReview[] = [{ state: 'APPROVED', user: { login: 'alice' } }];
    expect(ghMapReviewDecision(reviews)).toBe('approved');
  });

  it('returns "review_required" for only comments', () => {
    const reviews: GitHubReview[] = [{ state: 'COMMENTED', user: { login: 'alice' } }];
    expect(ghMapReviewDecision(reviews)).toBe('review_required');
  });
});

describe('GitHub PR: hasUserReviewed', () => {
  it('returns true when user has approved', () => {
    const reviews: GitHubReview[] = [{ state: 'APPROVED', user: { login: 'me' } }];
    expect(hasUserReviewed(reviews, 'me')).toBe(true);
  });

  it('returns true when user has requested changes', () => {
    const reviews: GitHubReview[] = [{ state: 'CHANGES_REQUESTED', user: { login: 'me' } }];
    expect(hasUserReviewed(reviews, 'me')).toBe(true);
  });

  it('returns true when user has commented', () => {
    const reviews: GitHubReview[] = [{ state: 'COMMENTED', user: { login: 'me' } }];
    expect(hasUserReviewed(reviews, 'me')).toBe(true);
  });

  it('returns false when only other users reviewed', () => {
    const reviews: GitHubReview[] = [{ state: 'APPROVED', user: { login: 'someone-else' } }];
    expect(hasUserReviewed(reviews, 'me')).toBe(false);
  });

  it('returns false for empty reviews', () => {
    expect(hasUserReviewed([], 'me')).toBe(false);
  });

  it('returns false when user is null', () => {
    const reviews: GitHubReview[] = [{ state: 'APPROVED', user: null }];
    expect(hasUserReviewed(reviews, 'me')).toBe(false);
  });

  it('ignores non-review states like DISMISSED', () => {
    const reviews: GitHubReview[] = [{ state: 'DISMISSED', user: { login: 'me' } }];
    expect(hasUserReviewed(reviews, 'me')).toBe(false);
  });
});

// ── GitLab PR Mapping ─────────────────────────────────────────

describe('GitLab MR: mapCIStatus', () => {
  it.each([
    [null, 'unknown'],
    ['success', 'success'],
    ['failed', 'failure'],
    ['running', 'pending'],
    ['pending', 'pending'],
    ['created', 'pending'],
    ['canceled', 'unknown'],
    ['skipped', 'unknown']
  ])('maps pipeline status "%s" to "%s"', (input, expected) => {
    expect(glMapCIStatus(input)).toBe(expected);
  });
});

describe('GitLab MR: mapReviewDecision', () => {
  it('returns "approved" when approved_by is non-empty', () => {
    const mr = {
      approved_by: [{ user: { username: 'reviewer' } }],
      reviewers: [{ username: 'reviewer' }]
    };
    expect(glMapReviewDecision(mr as never)).toBe('approved');
  });

  it('returns "review_required" when reviewers assigned but not approved', () => {
    const mr = {
      approved_by: [],
      reviewers: [{ username: 'reviewer' }]
    };
    expect(glMapReviewDecision(mr as never)).toBe('review_required');
  });

  it('returns null when no reviewers and no approvals', () => {
    const mr = { approved_by: [], reviewers: [] };
    expect(glMapReviewDecision(mr as never)).toBeNull();
  });
});

describe('GitLab MR: hasUserApproved', () => {
  it('returns true when user is in approvals', () => {
    const approvals = [{ user: { username: 'me' } }];
    expect(hasUserApproved(approvals, 'me')).toBe(true);
  });

  it('returns false when user is not in approvals', () => {
    const approvals = [{ user: { username: 'someone-else' } }];
    expect(hasUserApproved(approvals, 'me')).toBe(false);
  });

  it('returns false when approvals is empty', () => {
    expect(hasUserApproved([], 'me')).toBe(false);
  });
});
