import { describe, it, expect, vi, beforeEach } from 'vitest';

const safeFetch = vi.fn();
vi.mock('$lib/utils/fetch', () => ({ safeFetch: (...args: unknown[]) => safeFetch(...args) }));
vi.mock('$lib/utils/logger', () => ({ error: vi.fn(), info: vi.fn() }));

import { mapBasicIssue, repoFromWebUrl, fetchGitLabIssuesBasic } from './issues';

function glIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    iid: 5,
    title: 'Latency spike',
    web_url: 'https://gitlab.com/group/project/-/issues/5',
    state: 'opened',
    created_at: '2026-07-01T10:00:00Z',
    updated_at: '2026-07-02T10:00:00Z',
    author: { username: 'gluser', avatar_url: 'https://example.com/a.png' },
    labels: ['performance'],
    user_notes_count: 2,
    project_id: 77,
    ...overrides
  };
}

describe('GitLab issues: repoFromWebUrl', () => {
  it('derives group/project from an issue web URL', () => {
    expect(repoFromWebUrl('https://gitlab.com/group/project/-/issues/5', 77)).toBe('group/project');
  });

  it('handles nested subgroups', () => {
    expect(repoFromWebUrl('https://gitlab.com/a/b/c/-/issues/1', 1)).toBe('a/b/c');
  });

  it('falls back to project id on an unparseable URL', () => {
    expect(repoFromWebUrl('not-a-url', 42)).toBe('project/42');
  });
});

describe('GitLab issues: mapBasicIssue', () => {
  it('prefers references.full when available', () => {
    const result = mapBasicIssue(
      glIssue({ references: { full: 'group/project#5' } }) as never,
      'authored'
    );
    expect(result.repository).toBe('group/project');
    expect(result).toMatchObject({
      id: 'gitlab-issue-100',
      source: 'gitlab',
      number: 5,
      role: 'authored',
      labels: ['performance'],
      commentsCount: 2
    });
  });

  it('parses repository from web_url when references missing', () => {
    const result = mapBasicIssue(glIssue() as never, 'assigned');
    expect(result.repository).toBe('group/project');
  });
});

describe('GitLab issues: fetchGitLabIssuesBasic', () => {
  beforeEach(() => safeFetch.mockReset());

  it('dedupes assigned issues that are also authored (authored wins)', async () => {
    safeFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [glIssue({ id: 100 })] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [glIssue({ id: 100 }), glIssue({ id: 200, iid: 9 })]
      });

    const issues = await fetchGitLabIssuesBasic('token', 'https://gitlab.com', 'me');

    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({ id: 'gitlab-issue-100', role: 'authored' });
    expect(issues[1]).toMatchObject({ id: 'gitlab-issue-200', role: 'assigned' });
  });

  it('returns empty list when both requests fail', async () => {
    safeFetch.mockResolvedValue({ ok: false, status: 500 });
    const issues = await fetchGitLabIssuesBasic('token', 'https://gitlab.com', 'me');
    expect(issues).toEqual([]);
  });
});
