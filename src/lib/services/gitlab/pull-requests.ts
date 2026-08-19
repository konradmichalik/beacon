import type {
  UnifiedPullRequest,
  CIStatus,
  ReviewDecision,
  MergeStatus,
  FailingCheck
} from '$lib/types';
import { safeFetch } from '$lib/utils/fetch';
import { error as logError, info as logInfo } from '$lib/utils/logger';

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
    readonly id: number;
    readonly status: string;
    readonly web_url: string | null;
  } | null;
  readonly detailed_merge_status?: string;
  readonly target_branch: string;
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

export function mapCIStatus(pipelineStatus: string | null): CIStatus {
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

const GITLAB_BLOCKED_STATUSES = new Set([
  'not_approved',
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
]);

/**
 * The deprecated `merge_status` is deliberately not used as a fallback: its
 * `can_be_merged` ignores approval rules and would claim mergeable on exactly
 * the projects that require approvals. Everything not explicitly blocked falls
 * through to unknown: the transient states (`unchecked`, `checking`, `preparing`,
 * `approvals_syncing`) and any status GitLab adds after this was written.
 */
export function mapMergeStatus(detailed: string | undefined): MergeStatus {
  if (detailed === 'mergeable') return 'mergeable';
  if (GITLAB_BLOCKED_STATUSES.has(detailed ?? '')) return 'blocked';
  return 'unknown';
}

/**
 * GitLab has no per-check name like GitHub's check-runs — a pipeline is one
 * unit — so the "check" name is synthesized from the pipeline id.
 */
export function mapFailingCheck(
  pipeline: GitLabMergeRequest['head_pipeline']
): FailingCheck | null {
  if (!pipeline || mapCIStatus(pipeline.status) !== 'failure' || !pipeline.web_url) return null;
  return { name: `Pipeline #${pipeline.id}`, url: pipeline.web_url };
}

export function mapReviewDecision(mr: GitLabMergeRequest): ReviewDecision | null {
  if (mr.approved_by && mr.approved_by.length > 0) return 'approved';
  if (mr.reviewers && mr.reviewers.length > 0) return 'review_required';
  return null;
}

export function hasUserApproved(
  approvals: readonly { user: { username: string } }[],
  username: string
): boolean {
  const normalized = username.toLowerCase();
  return approvals.some((a) => a.user.username.toLowerCase() === normalized);
}

interface GitLabApproval {
  readonly user: { readonly username: string };
}

interface GitLabApprovalsResponse {
  readonly approved_by: readonly GitLabApproval[];
}

async function fetchApprovals(
  token: string,
  baseUrl: string,
  projectId: number,
  mrIid: number,
  signal?: AbortSignal
): Promise<readonly GitLabApproval[] | null> {
  try {
    const api = baseUrl.replace(/\/$/, '');
    const response = await safeFetch(
      `${api}/api/v4/projects/${projectId}/merge_requests/${mrIid}/approvals`,
      { headers: { Authorization: `Bearer ${token}` }, signal }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as GitLabApprovalsResponse;
    return data.approved_by ?? [];
  } catch {
    return null;
  }
}

// Cache project paths to avoid refetching
const projectPathCache = new Map<number, string>();

async function fetchProjectPath(
  token: string,
  baseUrl: string,
  projectId: number,
  signal?: AbortSignal
): Promise<string> {
  const cached = projectPathCache.get(projectId);
  if (cached) return cached;

  try {
    const response = await safeFetch(
      `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}?simple=true`,
      { headers: { Authorization: `Bearer ${token}` }, signal }
    );
    if (!response.ok) return `project/${projectId}`;
    const data = (await response.json()) as GitLabProject;
    projectPathCache.set(projectId, data.path_with_namespace);
    return data.path_with_namespace;
  } catch {
    return `project/${projectId}`;
  }
}

function mapBasicMR(mr: GitLabMergeRequest, reviewRequested: boolean): UnifiedPullRequest {
  return {
    id: `gitlab-mr-${mr.id}`,
    source: 'gitlab',
    title: mr.title,
    repository: mr.references?.full?.split('!')[0] ?? `project/${mr.project_id}`,
    url: mr.web_url,
    number: mr.iid,
    draft: mr.draft,
    author: mr.author ? { login: mr.author.username, avatarUrl: mr.author.avatar_url } : null,
    createdAt: mr.created_at,
    updatedAt: mr.updated_at,
    // GitLab list endpoint includes pipeline status
    ciStatus: mapCIStatus(mr.head_pipeline?.status ?? null),
    failingCheck: mapFailingCheck(mr.head_pipeline) ?? undefined,
    reviewDecision: mapReviewDecision(mr),
    mergeStatus: mapMergeStatus(mr.detailed_merge_status),
    reviewRequestedFromMe: reviewRequested,
    reviewedByMe: false,
    baseBranch: mr.target_branch,
    enrichment: 'pending',
    sourceMetadata: { projectId: mr.project_id }
  };
}

export async function fetchGitLabMergeRequestsBasic(
  token: string,
  baseUrl: string,
  username: string
): Promise<UnifiedPullRequest[]> {
  const api = `${baseUrl.replace(/\/$/, '')}/api/v4`;
  const headers = { Authorization: `Bearer ${token}` };

  const [authoredRes, reviewRes] = await Promise.all([
    safeFetch(
      `${api}/merge_requests?state=opened&author_username=${encodeURIComponent(username)}&scope=all&per_page=50&order_by=updated_at`,
      { headers }
    ).catch(() => null),
    safeFetch(
      `${api}/merge_requests?state=opened&reviewer_username=${encodeURIComponent(username)}&scope=all&per_page=50&order_by=updated_at`,
      { headers }
    ).catch(() => null)
  ]);

  if (authoredRes && !authoredRes.ok) {
    logError('gitlab-mr', `authored MRs fetch failed: HTTP ${authoredRes.status}`);
  }
  if (reviewRes && !reviewRes.ok) {
    logError('gitlab-mr', `reviewer MRs fetch failed: HTTP ${reviewRes.status}`);
  }

  const authored: GitLabMergeRequest[] = authoredRes?.ok ? await authoredRes.json() : [];
  const reviewRequested: GitLabMergeRequest[] = reviewRes?.ok ? await reviewRes.json() : [];

  logInfo(
    'gitlab-mr',
    `fetched ${authored.length} authored, ${reviewRequested.length} review-requested MRs`
  );

  // Deduplicate: authored wins over review-requested (own MRs always show as "Created by me")
  const authoredIds = new Set(authored.map((mr) => mr.id));
  const reviewOnly = reviewRequested.filter((mr) => !authoredIds.has(mr.id));

  return [
    ...authored.map((mr) => mapBasicMR(mr, false)),
    ...reviewOnly.map((mr) => mapBasicMR(mr, true))
  ];
}

export async function enrichGitLabMR(
  token: string,
  baseUrl: string,
  pr: UnifiedPullRequest,
  username: string,
  signal?: AbortSignal
): Promise<UnifiedPullRequest> {
  const projectId = (pr.sourceMetadata?.projectId as number) ?? 0;
  if (!projectId) return { ...pr, enrichment: 'enriched' };

  const [repository, approvalsResult] = await Promise.all([
    fetchProjectPath(token, baseUrl, projectId, signal),
    pr.reviewRequestedFromMe
      ? fetchApprovals(token, baseUrl, projectId, pr.number, signal)
      : Promise.resolve(null)
  ]);

  // null = fetch failed, keep previous state
  if (approvalsResult === null && pr.reviewRequestedFromMe) {
    return { ...pr, repository, enrichment: 'enriched' };
  }

  const approvals = approvalsResult ?? [];
  const reviewDecision: ReviewDecision | null = pr.reviewRequestedFromMe
    ? approvals.length > 0
      ? 'approved'
      : 'review_required'
    : pr.reviewDecision;

  return {
    ...pr,
    repository,
    reviewDecision,
    // GitLab REST API only exposes approvals, not comment-based reviews (unlike GitHub)
    reviewedByMe: hasUserApproved(approvals, username),
    enrichment: 'enriched'
  };
}
