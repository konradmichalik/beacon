import type { UnifiedIssue, IssueRole } from '$lib/types';
import { safeFetch } from '$lib/utils/fetch';
import { error as logError, info as logInfo } from '$lib/utils/logger';

interface GitLabIssue {
  readonly id: number;
  readonly iid: number;
  readonly title: string;
  readonly web_url: string;
  readonly state: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly author: {
    readonly username: string;
    readonly avatar_url: string;
  };
  readonly labels?: readonly string[];
  readonly user_notes_count?: number;
  readonly references?: {
    readonly full: string;
  };
  readonly project_id: number;
}

// Derive "group/project" from an issue web URL, e.g.
// https://gitlab.com/group/project/-/issues/5 -> group/project
export function repoFromWebUrl(webUrl: string, projectId: number): string {
  try {
    const path = new URL(webUrl).pathname.replace(/^\//, '');
    const [repo] = path.split('/-/issues');
    return repo || `project/${projectId}`;
  } catch {
    return `project/${projectId}`;
  }
}

export function mapBasicIssue(issue: GitLabIssue, role: IssueRole): UnifiedIssue {
  return {
    id: `gitlab-issue-${issue.id}`,
    source: 'gitlab',
    title: issue.title,
    repository:
      issue.references?.full?.split('#')[0] ?? repoFromWebUrl(issue.web_url, issue.project_id),
    url: issue.web_url,
    number: issue.iid,
    author: issue.author
      ? { login: issue.author.username, avatarUrl: issue.author.avatar_url }
      : null,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    role,
    labels: issue.labels ?? [],
    commentsCount: issue.user_notes_count
  };
}

export async function fetchGitLabIssuesBasic(
  token: string,
  baseUrl: string,
  username: string
): Promise<UnifiedIssue[]> {
  const api = `${baseUrl.replace(/\/$/, '')}/api/v4`;
  const headers = { Authorization: `Bearer ${token}` };

  const [authoredRes, assignedRes] = await Promise.all([
    safeFetch(
      `${api}/issues?state=opened&author_username=${encodeURIComponent(username)}&scope=all&per_page=50&order_by=updated_at`,
      { headers }
    ).catch(() => null),
    safeFetch(
      `${api}/issues?state=opened&assignee_username=${encodeURIComponent(username)}&scope=all&per_page=50&order_by=updated_at`,
      { headers }
    ).catch(() => null)
  ]);

  if (authoredRes && !authoredRes.ok) {
    logError('gitlab-issue', `authored issues fetch failed: HTTP ${authoredRes.status}`);
  }
  if (assignedRes && !assignedRes.ok) {
    logError('gitlab-issue', `assigned issues fetch failed: HTTP ${assignedRes.status}`);
  }

  const authored: GitLabIssue[] = authoredRes?.ok ? await authoredRes.json() : [];
  const assigned: GitLabIssue[] = assignedRes?.ok ? await assignedRes.json() : [];

  logInfo(
    'gitlab-issue',
    `fetched ${authored.length} authored, ${assigned.length} assigned issues`
  );

  // Deduplicate: authored wins over assigned (own issues show as "Created by me")
  const authoredIds = new Set(authored.map((i) => i.id));
  const assignedOnly = assigned.filter((i) => !authoredIds.has(i.id));

  return [
    ...authored.map((issue) => mapBasicIssue(issue, 'authored')),
    ...assignedOnly.map((issue) => mapBasicIssue(issue, 'assigned'))
  ];
}
