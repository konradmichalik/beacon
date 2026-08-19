import { describe, it, expect } from 'vitest';

import { mapMergeStatus } from './pull-requests';

describe('GitLab MRs: mapMergeStatus', () => {
  it('reports mergeable when GitLab says the branch merges cleanly', () => {
    expect(mapMergeStatus('mergeable')).toBe('mergeable');
  });

  it('reports blocked when approvals are missing', () => {
    expect(mapMergeStatus('not_approved')).toBe('blocked');
  });

  it.each([
    'ci_must_pass',
    'ci_still_running',
    'commits_status',
    'conflict',
    'discussions_not_resolved',
    'draft_status',
    'jira_association_missing',
    'merge_request_blocked',
    'merge_time',
    'need_rebase',
    'not_open',
    'requested_changes',
    'security_policy_violations'
  ])('reports blocked for %s', (status) => {
    expect(mapMergeStatus(status)).toBe('blocked');
  });

  it.each(['checking', 'preparing', 'approvals_syncing'])(
    'reports unknown while GitLab is still computing (%s)',
    (status) => {
      expect(mapMergeStatus(status)).toBe('unknown');
    }
  );

  it('reports unknown when the field is absent, as on GitLab before 15.6', () => {
    expect(mapMergeStatus(undefined)).toBe('unknown');
  });

  it('reports unknown for a status value it does not know yet', () => {
    expect(mapMergeStatus('some_future_status')).toBe('unknown');
  });
});
