import { describe, it, expect, vi, beforeEach } from 'vitest';

const safeFetch = vi.fn();
vi.mock('$lib/utils/fetch', () => ({ safeFetch: (...args: unknown[]) => safeFetch(...args) }));
vi.mock('$lib/utils/logger', () => ({ error: vi.fn(), info: vi.fn() }));

import { mapMergeStatus, fetchGitLabMergeRequestsBasic } from './pull-requests';

function mrItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    iid: 42,
    title: 'Add feature',
    web_url: 'https://gitlab.com/acme/frontend/-/merge_requests/42',
    state: 'opened',
    draft: false,
    created_at: '2026-07-01T10:00:00Z',
    updated_at: '2026-07-02T10:00:00Z',
    author: { username: 'octocat', avatar_url: 'https://example.com/a.png' },
    project_id: 7,
    references: { full: 'acme/frontend!42' },
    detailed_merge_status: 'mergeable',
    target_branch: 'main',
    ...overrides
  };
}

function okResponse(items: unknown[]) {
  return { ok: true, json: async () => items };
}

describe('GitLab MRs: fetchGitLabMergeRequestsBasic', () => {
  beforeEach(() => safeFetch.mockReset());

  it('reports complete when both requests succeed', async () => {
    safeFetch.mockResolvedValueOnce(okResponse([mrItem({ id: 1 })]));
    safeFetch.mockResolvedValueOnce(okResponse([]));

    const { items, complete } = await fetchGitLabMergeRequestsBasic(
      'token',
      'https://gitlab.com',
      'me'
    );

    expect(items).toHaveLength(1);
    expect(complete).toBe(true);
  });

  it('reports incomplete when a request fails, while keeping the successful half', async () => {
    safeFetch
      .mockResolvedValueOnce(okResponse([mrItem({ id: 1 })]))
      .mockResolvedValueOnce({ ok: false, status: 503 });

    const { items, complete } = await fetchGitLabMergeRequestsBasic(
      'token',
      'https://gitlab.com',
      'me'
    );

    expect(items).toHaveLength(1);
    expect(complete).toBe(false);
  });

  it('reports incomplete when a request rejects outright', async () => {
    safeFetch
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(okResponse([]));

    const { complete } = await fetchGitLabMergeRequestsBasic('token', 'https://gitlab.com', 'me');

    expect(complete).toBe(false);
  });
});

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
    'security_policy_violations',
    'security_policy_pipeline_check',
    'status_checks_must_pass',
    'locked_paths',
    'locked_lfs_files',
    'title_regex'
  ])('reports blocked for %s', (status) => {
    expect(mapMergeStatus(status)).toBe('blocked');
  });

  it.each(['checking', 'preparing', 'approvals_syncing', 'unchecked'])(
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
