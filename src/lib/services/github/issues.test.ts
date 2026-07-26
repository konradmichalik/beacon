import { describe, it, expect, vi, beforeEach } from 'vitest';

const safeFetch = vi.fn();
vi.mock('$lib/utils/fetch', () => ({ safeFetch: (...args: unknown[]) => safeFetch(...args) }));
vi.mock('$lib/utils/logger', () => ({ error: vi.fn(), info: vi.fn() }));

import { mapBasicIssue, fetchGitHubIssuesBasic } from './issues';

function searchItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    number: 42,
    title: 'Something broke',
    html_url: 'https://github.com/acme/frontend/issues/42',
    state: 'open',
    comments: 3,
    created_at: '2026-07-01T10:00:00Z',
    updated_at: '2026-07-02T10:00:00Z',
    user: { login: 'octocat', avatar_url: 'https://example.com/a.png' },
    repository_url: 'https://api.github.com/repos/acme/frontend',
    labels: [{ name: 'bug' }, { name: 'frontend' }],
    ...overrides
  };
}

function okResponse(items: unknown[]) {
  return { ok: true, json: async () => ({ total_count: items.length, items }) };
}

describe('GitHub issues: mapBasicIssue', () => {
  it('maps a search item to a UnifiedIssue', () => {
    const result = mapBasicIssue(searchItem() as never, 'assigned');
    expect(result).toEqual({
      id: 'github-issue-1',
      source: 'github',
      title: 'Something broke',
      repository: 'acme/frontend',
      url: 'https://github.com/acme/frontend/issues/42',
      number: 42,
      author: { login: 'octocat', avatarUrl: 'https://example.com/a.png' },
      createdAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-07-02T10:00:00Z',
      role: 'assigned',
      labels: ['bug', 'frontend'],
      commentsCount: 3
    });
  });

  it('handles missing author and labels', () => {
    const result = mapBasicIssue(
      searchItem({ user: null, labels: undefined, comments: undefined }) as never,
      'authored'
    );
    expect(result.author).toBeNull();
    expect(result.labels).toEqual([]);
    expect(result.commentsCount).toBeUndefined();
  });
});

describe('GitHub issues: fetchGitHubIssuesBasic', () => {
  beforeEach(() => safeFetch.mockReset());

  it('dedupes assigned issues that are also authored (authored wins)', async () => {
    // authored query returns #1, assigned returns #1 (dup) and #2
    safeFetch
      .mockResolvedValueOnce(okResponse([searchItem({ id: 1 })]))
      .mockResolvedValueOnce(okResponse([searchItem({ id: 1 }), searchItem({ id: 2, number: 7 })]));

    const issues = await fetchGitHubIssuesBasic('token', 'me');

    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({ id: 'github-issue-1', role: 'authored' });
    expect(issues[1]).toMatchObject({ id: 'github-issue-2', role: 'assigned' });
  });

  it('drops pull requests that slip into the search results', async () => {
    safeFetch
      .mockResolvedValueOnce(okResponse([searchItem({ id: 1, pull_request: { url: 'x' } })]))
      .mockResolvedValueOnce(okResponse([]));

    const issues = await fetchGitHubIssuesBasic('token', 'me');
    expect(issues).toHaveLength(0);
  });

  it('returns empty list when both requests fail', async () => {
    safeFetch.mockResolvedValue({ ok: false, status: 500 });
    const issues = await fetchGitHubIssuesBasic('token', 'me');
    expect(issues).toEqual([]);
  });
});
