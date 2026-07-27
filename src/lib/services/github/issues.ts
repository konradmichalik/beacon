import type { UnifiedIssue, IssueRole } from '$lib/types';
import { safeFetch } from '$lib/utils/fetch';
import { error as logError, info as logInfo } from '$lib/utils/logger';
import { repoFromUrl } from './pull-requests';

const GITHUB_API = 'https://api.github.com';

const HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
});

interface GitHubIssueSearchItem {
  readonly id: number;
  readonly number: number;
  readonly title: string;
  readonly html_url: string;
  readonly state: string;
  readonly comments?: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly user: {
    readonly login: string;
    readonly avatar_url: string;
  } | null;
  readonly repository_url: string;
  readonly labels?: readonly { readonly name: string }[];
  // Present only when the search result is actually a pull request. The
  // `type:issue` query excludes PRs, but we defend against it regardless.
  readonly pull_request?: unknown;
}

interface GitHubIssueSearchResponse {
  readonly total_count: number;
  readonly items: readonly GitHubIssueSearchItem[];
}

export function mapBasicIssue(item: GitHubIssueSearchItem, role: IssueRole): UnifiedIssue {
  return {
    id: `github-issue-${item.id}`,
    source: 'github',
    title: item.title,
    repository: repoFromUrl(item.repository_url),
    url: item.html_url,
    number: item.number,
    author: item.user ? { login: item.user.login, avatarUrl: item.user.avatar_url } : null,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    role,
    labels: item.labels?.map((l) => l.name) ?? [],
    commentsCount: item.comments
  };
}

export async function fetchGitHubIssuesBasic(
  token: string,
  username: string
): Promise<UnifiedIssue[]> {
  const [authoredRes, assignedRes] = await Promise.all([
    safeFetch(
      `${GITHUB_API}/search/issues?q=type:issue+state:open+author:${encodeURIComponent(username)}&per_page=50&sort=updated`,
      { headers: HEADERS(token) }
    ).catch(() => null),
    safeFetch(
      `${GITHUB_API}/search/issues?q=type:issue+state:open+assignee:${encodeURIComponent(username)}&per_page=50&sort=updated`,
      { headers: HEADERS(token) }
    ).catch(() => null)
  ]);

  if (authoredRes && !authoredRes.ok) {
    logError('github-issue', `authored issues fetch failed: HTTP ${authoredRes.status}`);
  }
  if (assignedRes && !assignedRes.ok) {
    logError('github-issue', `assigned issues fetch failed: HTTP ${assignedRes.status}`);
  }

  const authored: GitHubIssueSearchResponse = authoredRes?.ok
    ? await authoredRes.json()
    : { total_count: 0, items: [] };
  const assigned: GitHubIssueSearchResponse = assignedRes?.ok
    ? await assignedRes.json()
    : { total_count: 0, items: [] };

  // Defensively drop any pull requests that slipped through the search.
  const authoredIssues = authored.items.filter((i) => !i.pull_request);
  const assignedIssues = assigned.items.filter((i) => !i.pull_request);

  logInfo(
    'github-issue',
    `fetched ${authoredIssues.length} authored, ${assignedIssues.length} assigned issues`
  );

  // Deduplicate: authored wins over assigned (own issues show as "Created by me")
  const authoredIds = new Set(authoredIssues.map((i) => i.id));
  const assignedOnly = assignedIssues.filter((i) => !authoredIds.has(i.id));

  return [
    ...authoredIssues.map((item) => mapBasicIssue(item, 'authored')),
    ...assignedOnly.map((item) => mapBasicIssue(item, 'assigned'))
  ];
}
