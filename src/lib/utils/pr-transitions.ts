import type { UnifiedPullRequest, MergeStatus, CIStatus } from '$lib/types';

export type PRTransitionKind = 'ready_for_review' | 'mergeable' | 'unmergeable' | 'ci_failed';

export interface PRStateSnapshot {
  readonly draft: boolean;
  readonly mergeStatus: MergeStatus;
  readonly ciStatus: CIStatus;
}

export interface PRTransition {
  readonly kind: PRTransitionKind;
  readonly pr: UnifiedPullRequest;
}

export interface PRTransitionResult {
  readonly transitions: readonly PRTransition[];
  readonly baseline: Map<string, PRStateSnapshot>;
}

/**
 * Detects PR state transitions that neither GitHub nor GitLab push a native
 * notification for. A PR seen for the first time is only recorded, never
 * reported, so a fresh app start never floods the list with PRs that were
 * already ready or mergeable. `mergeStatus: 'unknown'` (or `ciStatus:
 * 'unknown'`) means "no information" on both platforms, so it never
 * overwrites a remembered concrete baseline and never itself triggers a
 * transition.
 *
 * `unmergeable` and `ci_failed` are restricted to GitHub: GitLab already
 * raises a native todo (and therefore a real notification) for both a merge
 * request becoming unmergeable and a failed pipeline, so detecting them here
 * too would just duplicate that notification.
 */
export function detectPRTransitions(
  prs: readonly UnifiedPullRequest[],
  baseline: ReadonlyMap<string, PRStateSnapshot>
): PRTransitionResult {
  const transitions: PRTransition[] = [];
  const nextBaseline = new Map<string, PRStateSnapshot>();

  for (const pr of prs) {
    const previous = baseline.get(pr.id);

    if (previous) {
      // A draft flip resets the remembered merge status regardless of role:
      // GitHub maps a draft PR's merge state to 'blocked', so leaving draft
      // often surfaces as blocked -> mergeable on the very next poll purely
      // as a side effect of this one user action, not an independent event.
      if (previous.draft && !pr.draft) {
        if (pr.reviewRequestedFromMe) {
          transitions.push({ kind: 'ready_for_review', pr });
        }
        nextBaseline.set(pr.id, {
          draft: pr.draft,
          mergeStatus: 'unknown',
          ciStatus: pr.ciStatus === 'unknown' ? previous.ciStatus : pr.ciStatus
        });
        continue;
      }

      if (
        previous.mergeStatus === 'blocked' &&
        pr.mergeStatus === 'mergeable' &&
        !pr.reviewRequestedFromMe
      ) {
        transitions.push({ kind: 'mergeable', pr });
      }

      // `!pr.draft` excludes the same GitHub side effect as above: converting
      // a mergeable PR back to draft also reports it as 'blocked', which is
      // not a real conflict.
      if (
        pr.source === 'github' &&
        !pr.draft &&
        previous.mergeStatus === 'mergeable' &&
        pr.mergeStatus === 'blocked' &&
        !pr.reviewRequestedFromMe
      ) {
        transitions.push({ kind: 'unmergeable', pr });
      }

      if (
        pr.source === 'github' &&
        (previous.ciStatus === 'success' || previous.ciStatus === 'pending') &&
        pr.ciStatus === 'failure' &&
        !pr.reviewRequestedFromMe
      ) {
        transitions.push({ kind: 'ci_failed', pr });
      }
    }

    nextBaseline.set(pr.id, {
      draft: pr.draft,
      mergeStatus:
        pr.mergeStatus === 'unknown' ? (previous?.mergeStatus ?? 'unknown') : pr.mergeStatus,
      ciStatus: pr.ciStatus === 'unknown' ? (previous?.ciStatus ?? 'unknown') : pr.ciStatus
    });
  }

  return { transitions, baseline: nextBaseline };
}
