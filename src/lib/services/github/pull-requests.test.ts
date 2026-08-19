import { describe, it, expect, vi, beforeEach } from 'vitest';

const safeFetch = vi.fn();
vi.mock('$lib/utils/fetch', () => ({ safeFetch: (...args: unknown[]) => safeFetch(...args) }));
vi.mock('$lib/utils/logger', () => ({ error: vi.fn(), info: vi.fn() }));

import { fetchGitHubPullRequestsBasic, mapMergeStatus } from './pull-requests';

function searchItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    number: 42,
    title: 'Add feature',
    html_url: 'https://github.com/acme/frontend/pull/42',
    state: 'open',
    draft: false,
    created_at: '2026-07-01T10:00:00Z',
    updated_at: '2026-07-02T10:00:00Z',
    user: { login: 'octocat', avatar_url: 'https://example.com/a.png' },
    repository_url: 'https://api.github.com/repos/acme/frontend',
    ...overrides
  };
}

function okResponse(items: unknown[]) {
  return { ok: true, json: async () => ({ total_count: items.length, items }) };
}

describe('GitHub PRs: fetchGitHubPullRequestsBasic', () => {
  beforeEach(() => safeFetch.mockReset());

  it('routes both requests through safeFetch, not the global fetch', async () => {
    safeFetch.mockResolvedValueOnce(okResponse([searchItem({ id: 1 })]));
    safeFetch.mockResolvedValueOnce(okResponse([]));

    await fetchGitHubPullRequestsBasic('token', 'me');

    expect(safeFetch).toHaveBeenCalledTimes(2);
  });

  it('dedupes review-requested PRs that are also authored (authored wins)', async () => {
    safeFetch
      .mockResolvedValueOnce(okResponse([searchItem({ id: 1 })]))
      .mockResolvedValueOnce(okResponse([searchItem({ id: 1 }), searchItem({ id: 2, number: 7 })]));

    const prs = await fetchGitHubPullRequestsBasic('token', 'me');

    expect(prs).toHaveLength(2);
    expect(prs[0]).toMatchObject({ id: 'github-pr-1', reviewRequestedFromMe: false });
    expect(prs[1]).toMatchObject({ id: 'github-pr-2', reviewRequestedFromMe: true });
  });

  it('returns an empty list when both requests fail', async () => {
    safeFetch.mockResolvedValue({ ok: false, status: 500 });
    const prs = await fetchGitHubPullRequestsBasic('token', 'me');
    expect(prs).toEqual([]);
  });
});

describe('GitHub PRs: mapMergeStatus', () => {
  it('reports mergeable only for a clean state', () => {
    expect(mapMergeStatus('clean')).toBe('mergeable');
  });

  it('reports blocked when required reviews or checks are missing', () => {
    expect(mapMergeStatus('blocked')).toBe('blocked');
  });

  it('reports blocked for unstable, where GitHub allows the merge but optional checks are red', () => {
    expect(mapMergeStatus('unstable')).toBe('blocked');
  });

  it.each(['behind', 'dirty', 'draft', 'has_hooks'])('reports blocked for %s', (state) => {
    expect(mapMergeStatus(state)).toBe('blocked');
  });

  it('reports unknown while GitHub is still computing mergeability', () => {
    expect(mapMergeStatus('unknown')).toBe('unknown');
  });

  it('reports unknown when the detail fetch yielded nothing', () => {
    expect(mapMergeStatus(null)).toBe('unknown');
    expect(mapMergeStatus(undefined)).toBe('unknown');
  });

  it('reports unknown for a state value it does not know yet', () => {
    expect(mapMergeStatus('some_future_state')).toBe('unknown');
  });
});
