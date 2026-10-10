import { describe, it, expect } from 'vitest';
import {
  notificationChips,
  pullRequestChips,
  pullRequestRef,
  issueRow,
  repoShortName
} from './row-chips';
import type { UnifiedIssue, UnifiedNotification, UnifiedPullRequest } from '$lib/types';

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
    createdAt: '2026-08-17T09:00:00Z',
    updatedAt: '2026-08-17T10:00:00Z',
    ciStatus: 'unknown',
    reviewDecision: null,
    mergeStatus: 'unknown',
    reviewRequestedFromMe: false,
    reviewedByMe: false,
    enrichment: 'enriched',
    ...overrides
  };
}

const NOW = new Date('2026-08-17T12:00:00Z');

describe('repoShortName', () => {
  it('keeps the last two path segments', () => {
    expect(repoShortName('group/sub/project')).toBe('sub/project');
    expect(repoShortName('owner/repo')).toBe('owner/repo');
  });
});

describe('pullRequestRef', () => {
  it('uses # for GitHub and ! for GitLab', () => {
    expect(pullRequestRef('github', 339)).toBe('#339');
    expect(pullRequestRef('gitlab', 87)).toBe('!87');
  });
});

describe('notificationChips', () => {
  it('shows a status chip for an actionable reason', () => {
    const chips = notificationChips(makeNotification({ reason: 'review_requested' }));
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ label: 'Review requested', tone: 'brand' });
  });

  it('never shows an Open chip', () => {
    const chips = notificationChips(makeNotification({ reason: 'mention', subjectState: 'open' }));
    expect(chips.map((c) => c.label)).toEqual(['Mentioned']);
  });

  it('adds a state chip for merged and closed items', () => {
    const merged = notificationChips(
      makeNotification({ reason: 'mention', subjectState: 'merged' })
    );
    expect(merged.map((c) => c.label)).toEqual(['Mentioned', 'Merged']);
    expect(merged[1].tone).toBe('discovery');

    const closed = notificationChips(
      makeNotification({ reason: 'mention', subjectState: 'closed' })
    );
    expect(closed[1]).toMatchObject({ label: 'Closed', tone: 'danger' });
  });

  it('adds a Draft chip when the item is a draft and not closed or merged', () => {
    const chips = notificationChips(makeNotification({ reason: 'ci_failed', draft: true }));
    expect(chips.map((c) => c.label)).toEqual(['CI failed', 'Draft']);
  });

  it('prefers the closed or merged state over Draft', () => {
    const chips = notificationChips(
      makeNotification({ reason: 'mention', draft: true, subjectState: 'merged' })
    );
    expect(chips.map((c) => c.label)).toEqual(['Mentioned', 'Merged']);
  });

  it('puts failures first so the row never leads with a calm chip', () => {
    const chips = notificationChips(makeNotification({ reason: 'ci_failed', draft: true }));
    expect(chips[0].tone).toBe('danger');
  });

  it('drops a neutral reason when a state chip already says it', () => {
    const chips = notificationChips(
      makeNotification({ reason: 'state_change', subjectState: 'merged' })
    );
    expect(chips.map((c) => c.label)).toEqual(['Merged']);
  });

  it('keeps a neutral reason chip when nothing else is shown', () => {
    const chips = notificationChips(makeNotification({ reason: 'comment' }));
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ label: 'Commented', tone: 'neutral' });
  });

  it('marks synthetic notifications on the reason chip instead of adding a badge', () => {
    const chips = notificationChips(
      makeNotification({ reason: 'mergeable', synthetic: true, id: 'beacon:pr-mergeable:x' })
    );
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ label: 'Ready to merge', tone: 'success', synthetic: true });
  });

  it('falls back to a capitalized neutral chip for unknown reasons', () => {
    const chips = notificationChips(makeNotification({ reason: 'some_new_reason' }));
    expect(chips[0]).toMatchObject({ label: 'Some new reason', tone: 'neutral' });
  });

  it('returns no chip when there is neither a reason nor a state', () => {
    expect(notificationChips(makeNotification({ reason: '', subjectState: null }))).toEqual([]);
  });
});

describe('pullRequestChips', () => {
  it('shows only a skeleton marker for GitHub while enrichment is pending', () => {
    const row = pullRequestChips(
      makePR({ enrichment: 'pending', ciStatus: 'failure', reviewDecision: 'changes_requested' }),
      NOW
    );
    expect(row.chips).toEqual([]);
    expect(row.metas).toEqual([]);
    expect(row.pending).toBe(true);
  });

  it('does not show a skeleton for GitLab while pending', () => {
    const row = pullRequestChips(makePR({ source: 'gitlab', enrichment: 'pending' }), NOW);
    expect(row.pending).toBe(false);
  });

  it('shows CI failed as the status chip and links the failing check', () => {
    const row = pullRequestChips(
      makePR({ ciStatus: 'failure', failingCheck: { name: 'lint', url: 'https://x/lint' } }),
      NOW
    );
    expect(row.chips[0]).toMatchObject({
      label: 'CI failed',
      tone: 'danger',
      tip: 'Open lint',
      clickable: true
    });
    expect(row.metas.some((m) => m.tip === 'CI failed')).toBe(false);
  });

  it('shows Changes requested as a chip for an authored PR', () => {
    const row = pullRequestChips(makePR({ reviewDecision: 'changes_requested' }), NOW);
    expect(row.chips[0]).toMatchObject({ label: 'Changes requested', tone: 'warning' });
  });

  it('shows Changes requested as a meta fact when CI failure takes the chip', () => {
    const row = pullRequestChips(
      makePR({ ciStatus: 'failure', reviewDecision: 'changes_requested' }),
      NOW
    );
    expect(row.chips[0].label).toBe('CI failed');
    expect(row.metas.map((m) => m.text)).toContain('Changes requested');
  });

  it('shows Your review when a review is requested from me and not done', () => {
    const row = pullRequestChips(makePR({ reviewRequestedFromMe: true, reviewedByMe: false }), NOW);
    expect(row.chips[0]).toMatchObject({ label: 'Your review', tone: 'brand' });
  });

  it('shows Reviewed as a calm meta fact once I reviewed', () => {
    const row = pullRequestChips(makePR({ reviewRequestedFromMe: true, reviewedByMe: true }), NOW);
    expect(row.chips).toEqual([]);
    expect(row.metas.map((m) => m.text)).toContain('Reviewed');
  });

  it('shows Ready to merge with CI and approval as quiet facts', () => {
    const row = pullRequestChips(
      makePR({ ciStatus: 'success', reviewDecision: 'approved', mergeStatus: 'mergeable' }),
      NOW
    );
    expect(row.chips[0]).toMatchObject({ label: 'Ready to merge', tone: 'success' });
    expect(row.metas.map((m) => m.tip)).toEqual(['CI passed', 'Approved']);
  });

  it('adds a Draft chip after the status chip', () => {
    const row = pullRequestChips(makePR({ draft: true, ciStatus: 'failure' }), NOW);
    expect(row.chips.map((c) => c.label)).toEqual(['CI failed', 'Draft']);
  });

  it('does not call a draft ready to merge', () => {
    const row = pullRequestChips(
      makePR({ draft: true, ciStatus: 'success', reviewDecision: 'approved' }),
      NOW
    );
    expect(row.chips.map((c) => c.label)).toEqual(['Draft']);
  });

  it('shows a neutral Stale chip when nothing else applies', () => {
    const row = pullRequestChips(makePR({ updatedAt: '2026-07-01T10:00:00Z' }), NOW);
    expect(row.chips[0]).toMatchObject({ label: 'Stale', tone: 'neutral' });
  });

  it('shows the target branch only when it is not main or master', () => {
    expect(pullRequestChips(makePR({ baseBranch: 'main' }), NOW).metas).toEqual([]);
    expect(pullRequestChips(makePR({ baseBranch: 'master' }), NOW).metas).toEqual([]);
    const row = pullRequestChips(makePR({ baseBranch: 'release/2.1' }), NOW);
    expect(row.metas.at(-1)).toMatchObject({ text: 'release/2.1', tip: 'Target: release/2.1' });
  });

  it('shows CI running as an icon-only fact', () => {
    const row = pullRequestChips(makePR({ ciStatus: 'pending' }), NOW);
    expect(row.metas[0]).toMatchObject({ text: '', tip: 'CI running', tone: 'warning' });
  });

  it('shows Review needed when a review is still required', () => {
    const row = pullRequestChips(makePR({ reviewDecision: 'review_required' }), NOW);
    expect(row.metas.map((m) => m.text)).toContain('Review needed');
  });
});

describe('issueRow', () => {
  function makeIssue(overrides: Partial<UnifiedIssue> = {}): UnifiedIssue {
    return {
      id: 'i1',
      source: 'github',
      title: 'Issue',
      repository: 'owner/repo',
      url: 'https://github.com/owner/repo/issues/1',
      number: 1,
      author: null,
      createdAt: '2026-08-17T09:00:00Z',
      updatedAt: '2026-08-17T10:00:00Z',
      role: 'authored',
      labels: [],
      ...overrides
    };
  }

  it('shows at most two labels and counts the rest', () => {
    const row = issueRow(makeIssue({ labels: ['bug', 'frontend', 'p1', 'p2'] }));
    expect(row.labels).toEqual(['bug', 'frontend']);
    expect(row.extraLabels).toBe(2);
  });

  it('shows the comment count only above zero', () => {
    expect(issueRow(makeIssue({ commentsCount: 0 })).metas).toEqual([]);
    expect(issueRow(makeIssue()).metas).toEqual([]);
    expect(issueRow(makeIssue({ commentsCount: 4 })).metas[0]).toMatchObject({
      text: '4',
      tip: '4 comments'
    });
  });
});
