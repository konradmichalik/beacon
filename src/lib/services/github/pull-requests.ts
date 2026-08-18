import type { UnifiedPullRequest, CIStatus, ReviewDecision, FailingCheck } from '$lib/types';
import { safeFetch } from '$lib/utils/fetch';
import { error as logError, info as logInfo } from '$lib/utils/logger';

const GITHUB_API = 'https://api.github.com';

const HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
});

interface GitHubSearchItem {
  readonly id: number;
  readonly number: number;
  readonly title: string;
  readonly html_url: string;
  readonly state: string;
  readonly draft?: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly user: {
    readonly login: string;
    readonly avatar_url: string;
  } | null;
  readonly repository_url: string;
  readonly pull_request?: {
    readonly html_url: string;
  };
}

interface GitHubSearchResponse {
  readonly total_count: number;
  readonly items: readonly GitHubSearchItem[];
}

export interface GitHubCheckRun {
  readonly conclusion: string | null;
  readonly status: string;
  readonly name: string;
  readonly html_url: string | null;
}

export interface GitHubReview {
  readonly state: string;
  readonly user: {
    readonly login: string;
  } | null;
}

export function repoFromUrl(repositoryUrl: string): string {
  // https://api.github.com/repos/owner/repo -> owner/repo
  return repositoryUrl.replace(`${GITHUB_API}/repos/`, '');
}

export function mapCIStatus(runs: readonly GitHubCheckRun[]): CIStatus {
  if (runs.length === 0) return 'unknown';
  if (runs.some((r) => r.status !== 'completed')) return 'pending';
  if (runs.every((r) => r.conclusion === 'success' || r.conclusion === 'skipped')) return 'success';
  if (runs.some((r) => r.conclusion === 'failure')) return 'failure';
  return 'unknown';
}

/** The first failed run, so a red PR can link straight to what broke. */
export function firstFailingCheck(runs: readonly GitHubCheckRun[]): FailingCheck | null {
  const failed = runs.find((r) => r.conclusion === 'failure' && r.html_url);
  if (!failed || !failed.html_url) return null;
  return { name: failed.name, url: failed.html_url };
}

export function mapReviewDecision(reviews: readonly GitHubReview[]): ReviewDecision | null {
  if (reviews.length === 0) return 'review_required';

  const states = reviews.map((r) => r.state);
  if (states.includes('CHANGES_REQUESTED')) return 'changes_requested';
  if (states.includes('APPROVED')) return 'approved';
  return 'review_required';
}

const REVIEWED_STATES = new Set(['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED']);

export function hasUserReviewed(reviews: readonly GitHubReview[], username: string): boolean {
  const normalized = username.toLowerCase();
  return reviews.some(
    (r) => r.user?.login?.toLowerCase() === normalized && REVIEWED_STATES.has(r.state)
  );
}

async function fetchCheckStatus(
  token: string,
  repo: string,
  ref: string,
  signal?: AbortSignal
): Promise<{ status: CIStatus; failingCheck: FailingCheck | null }> {
  try {
    const response = await safeFetch(
      `${GITHUB_API}/repos/${repo}/commits/${ref}/check-runs?per_page=100`,
      { headers: HEADERS(token), signal }
    );
    if (!response.ok) return { status: 'unknown', failingCheck: null };
    const data = (await response.json()) as { check_runs: GitHubCheckRun[] };
    return {
      status: mapCIStatus(data.check_runs),
      failingCheck: firstFailingCheck(data.check_runs)
    };
  } catch {
    return { status: 'unknown', failingCheck: null };
  }
}

async function fetchReviewStatus(
  token: string,
  repo: string,
  number: number,
  username: string,
  signal?: AbortSignal
): Promise<{ reviewDecision: ReviewDecision | null; reviewedByMe: boolean }> {
  try {
    const response = await safeFetch(
      `${GITHUB_API}/repos/${repo}/pulls/${number}/reviews?per_page=100`,
      { headers: HEADERS(token), signal }
    );
    if (!response.ok) return { reviewDecision: null, reviewedByMe: false };
    const data = (await response.json()) as GitHubReview[];
    return {
      reviewDecision: mapReviewDecision(data),
      reviewedByMe: hasUserReviewed(data, username)
    };
  } catch {
    return { reviewDecision: null, reviewedByMe: false };
  }
}

async function fetchPRDetail(
  token: string,
  repo: string,
  number: number,
  signal?: AbortSignal
): Promise<{ headSha: string; baseBranch: string } | null> {
  try {
    const response = await safeFetch(`${GITHUB_API}/repos/${repo}/pulls/${number}`, {
      headers: HEADERS(token),
      signal
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      head: { sha: string };
      base: { ref: string };
    };
    return { headSha: data.head.sha, baseBranch: data.base.ref };
  } catch {
    return null;
  }
}

function mapBasicPR(item: GitHubSearchItem, reviewRequested: boolean): UnifiedPullRequest {
  return {
    id: `github-pr-${item.id}`,
    source: 'github',
    title: item.title,
    repository: repoFromUrl(item.repository_url),
    url: item.pull_request?.html_url ?? item.html_url,
    number: item.number,
    draft: item.draft ?? false,
    author: item.user ? { login: item.user.login, avatarUrl: item.user.avatar_url } : null,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    ciStatus: 'unknown',
    reviewDecision: null,
    reviewRequestedFromMe: reviewRequested,
    reviewedByMe: false,
    enrichment: 'pending'
  };
}

export async function fetchGitHubPullRequestsBasic(
  token: string,
  username: string
): Promise<UnifiedPullRequest[]> {
  const [authoredRes, reviewRes] = await Promise.all([
    safeFetch(
      `${GITHUB_API}/search/issues?q=type:pr+state:open+author:${encodeURIComponent(username)}&per_page=50&sort=updated`,
      { headers: HEADERS(token) }
    ).catch(() => null),
    safeFetch(
      `${GITHUB_API}/search/issues?q=type:pr+state:open+review-requested:${encodeURIComponent(username)}&per_page=50&sort=updated`,
      { headers: HEADERS(token) }
    ).catch(() => null)
  ]);

  if (authoredRes && !authoredRes.ok) {
    logError('github-pr', `authored PRs fetch failed: HTTP ${authoredRes.status}`);
  }
  if (reviewRes && !reviewRes.ok) {
    logError('github-pr', `review-requested PRs fetch failed: HTTP ${reviewRes.status}`);
  }

  const authored: GitHubSearchResponse = authoredRes?.ok
    ? await authoredRes.json()
    : { total_count: 0, items: [] };
  const reviewRequested: GitHubSearchResponse = reviewRes?.ok
    ? await reviewRes.json()
    : { total_count: 0, items: [] };

  logInfo(
    'github-pr',
    `fetched ${authored.items.length} authored, ${reviewRequested.items.length} review-requested PRs`
  );

  // Deduplicate: authored wins over review-requested (own PRs always show as "Created by me")
  const authoredIds = new Set(authored.items.map((i) => i.id));
  const reviewOnly = reviewRequested.items.filter((i) => !authoredIds.has(i.id));

  return [
    ...authored.items.slice(0, 50).map((item) => mapBasicPR(item, false)),
    ...reviewOnly.slice(0, 50).map((item) => mapBasicPR(item, true))
  ];
}

export async function enrichGitHubPR(
  token: string,
  pr: UnifiedPullRequest,
  username: string,
  signal?: AbortSignal
): Promise<UnifiedPullRequest> {
  const repo = pr.repository;
  const detail = await fetchPRDetail(token, repo, pr.number, signal);

  const [checkStatus, reviewStatus] = await Promise.all([
    detail
      ? fetchCheckStatus(token, repo, detail.headSha, signal)
      : Promise.resolve({ status: 'unknown' as CIStatus, failingCheck: null }),
    fetchReviewStatus(token, repo, pr.number, username, signal)
  ]);

  return {
    ...pr,
    baseBranch: detail?.baseBranch,
    ciStatus: checkStatus.status,
    failingCheck: checkStatus.failingCheck ?? undefined,
    reviewDecision: reviewStatus.reviewDecision,
    reviewedByMe: reviewStatus.reviewedByMe,
    enrichment: 'enriched'
  };
}
