import type { UnifiedPullRequest, CIStatus, ReviewDecision } from '$lib/types';

interface GitLabMergeRequest {
  readonly id: number;
  readonly iid: number;
  readonly title: string;
  readonly web_url: string;
  readonly state: string;
  readonly draft: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly author: {
    readonly username: string;
    readonly avatar_url: string;
  };
  readonly reviewers: readonly { username: string }[];
  readonly approved_by?: readonly { user: { username: string } }[];
  readonly head_pipeline: {
    readonly status: string;
  } | null;
  readonly source_project_id: number;
  readonly target_project_id: number;
  readonly references?: {
    readonly full: string;
  };
  readonly project_id: number;
}

interface GitLabProject {
  readonly path_with_namespace: string;
}

function mapCIStatus(pipelineStatus: string | null): CIStatus {
  if (!pipelineStatus) return 'unknown';
  switch (pipelineStatus) {
    case 'success':
      return 'success';
    case 'failed':
      return 'failure';
    case 'running':
    case 'pending':
    case 'created':
      return 'pending';
    case 'canceled':
    case 'skipped':
      return 'unknown';
    default:
      return 'unknown';
  }
}

function mapReviewDecision(mr: GitLabMergeRequest): ReviewDecision | null {
  if (mr.approved_by && mr.approved_by.length > 0) return 'approved';
  if (mr.reviewers && mr.reviewers.length > 0) return 'review_required';
  return null;
}

// Cache project paths to avoid refetching
const projectPathCache = new Map<number, string>();

async function fetchProjectPath(
  token: string,
  baseUrl: string,
  projectId: number
): Promise<string> {
  const cached = projectPathCache.get(projectId);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}?simple=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) return `project/${projectId}`;
    const data = (await response.json()) as GitLabProject;
    projectPathCache.set(projectId, data.path_with_namespace);
    return data.path_with_namespace;
  } catch {
    return `project/${projectId}`;
  }
}

async function mapToUnified(
  token: string,
  baseUrl: string,
  mr: GitLabMergeRequest,
  reviewRequested: boolean
): Promise<UnifiedPullRequest> {
  const repository = await fetchProjectPath(token, baseUrl, mr.project_id);

  return {
    id: `gitlab-mr-${mr.id}`,
    source: 'gitlab',
    title: mr.title,
    repository,
    url: mr.web_url,
    number: mr.iid,
    draft: mr.draft,
    author: mr.author ? { login: mr.author.username, avatarUrl: mr.author.avatar_url } : null,
    createdAt: mr.created_at,
    updatedAt: mr.updated_at,
    ciStatus: mapCIStatus(mr.head_pipeline?.status ?? null),
    reviewDecision: mapReviewDecision(mr),
    reviewRequestedFromMe: reviewRequested
  };
}

export async function fetchGitLabMergeRequests(
  token: string,
  baseUrl: string,
  username: string
): Promise<UnifiedPullRequest[]> {
  const api = `${baseUrl.replace(/\/$/, '')}/api/v4`;
  const headers = { Authorization: `Bearer ${token}` };

  const [authoredRes, reviewRes] = await Promise.all([
    fetch(
      `${api}/merge_requests?state=opened&author_username=${encodeURIComponent(username)}&scope=all&per_page=30&order_by=updated_at`,
      { headers }
    ).catch(() => null),
    fetch(
      `${api}/merge_requests?state=opened&reviewer_username=${encodeURIComponent(username)}&scope=all&per_page=30&order_by=updated_at`,
      { headers }
    ).catch(() => null)
  ]);

  const authored: GitLabMergeRequest[] = authoredRes?.ok ? await authoredRes.json() : [];
  const reviewRequested: GitLabMergeRequest[] = reviewRes?.ok ? await reviewRes.json() : [];

  // Deduplicate: review-requested wins
  const reviewIds = new Set(reviewRequested.map((mr) => mr.id));
  const authoredOnly = authored.filter((mr) => !reviewIds.has(mr.id));

  const results = await Promise.all([
    ...reviewRequested.map((mr) => mapToUnified(token, baseUrl, mr, true)),
    ...authoredOnly.map((mr) => mapToUnified(token, baseUrl, mr, false))
  ]);

  return results;
}
