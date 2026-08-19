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
        // GitHub only learns the merge status while enriching, so the cached one
        // has to survive. GitLab carries it in every list response, and its
        // transient states map to `unknown` — restoring a cached `mergeable`
        // there would claim mergeable while GitLab is still checking.
        mergeStatus:
          pr.source === 'github' && pr.mergeStatus === 'unknown'
            ? cached.mergeStatus
            : pr.mergeStatus,
        reviewedByMe: cached.reviewedByMe,
        enrichment: 'enriched' as const
      };
    }
    return pr;
  });
}
