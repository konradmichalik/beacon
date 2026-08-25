import type { UnifiedPullRequest, MergeStatus } from '$lib/types';

export type PRTransitionKind = 'ready_for_review' | 'mergeable';

export interface PRStateSnapshot {
  readonly draft: boolean;
  readonly mergeStatus: MergeStatus;
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
 * already ready or mergeable. `mergeStatus: 'unknown'` means "no information"
 * on both platforms, so it never overwrites a remembered 'blocked' baseline
 * and never itself triggers the mergeable transition.
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
        nextBaseline.set(pr.id, { draft: pr.draft, mergeStatus: 'unknown' });
        continue;
      }

      if (
        previous.mergeStatus === 'blocked' &&
        pr.mergeStatus === 'mergeable' &&
        !pr.reviewRequestedFromMe
      ) {
        transitions.push({ kind: 'mergeable', pr });
      }
    }

    nextBaseline.set(pr.id, {
      draft: pr.draft,
      mergeStatus:
        pr.mergeStatus === 'unknown' ? (previous?.mergeStatus ?? 'unknown') : pr.mergeStatus
    });
  }

  return { transitions, baseline: nextBaseline };
}
