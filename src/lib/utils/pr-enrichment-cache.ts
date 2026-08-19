import type { UnifiedPullRequest } from '$lib/types';

/**
 * Carry enrichment (CI status, review decision, merge status, base branch) over from the
 * previous poll for pull requests that have not changed, so they do not have to
 * be re-fetched.
 *
 * A previous entry is reused only when it was fully `enriched` and its
 * `updatedAt` matches the fresh one — any change to the PR bumps `updatedAt` and
 * forces a re-fetch. The fresh base fields (title, draft, review-requested role,
 * …) are always kept; only the enrichment-derived fields are copied over.
 */
export function mergeCachedEnrichment(
  fresh: readonly UnifiedPullRequest[],
  previous: readonly UnifiedPullRequest[]
): UnifiedPullRequest[] {
  const cache = new Map(previous.map((pr) => [pr.id, pr]));

  return fresh.map((pr) => {
    const cached = cache.get(pr.id);
    if (cached && cached.enrichment === 'enriched' && cached.updatedAt === pr.updatedAt) {
      return {
        ...pr,
        baseBranch: cached.baseBranch,
        ciStatus: cached.ciStatus,
        failingCheck: cached.failingCheck,
        reviewDecision: cached.reviewDecision,
        // GitLab already carries a merge status in the list response, GitHub only
        // learns it while enriching. Reuse the cached one only where the fresh
        // value has nothing to say.
        mergeStatus: pr.mergeStatus === 'unknown' ? cached.mergeStatus : pr.mergeStatus,
        reviewedByMe: cached.reviewedByMe,
        enrichment: 'enriched' as const
      };
    }
    return pr;
  });
}
