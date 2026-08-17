import type { UnifiedPullRequest } from '$lib/types';

export type AttentionState = 'blocked' | 'failing' | 'ready' | 'stale' | 'none';

const DEFAULT_STALE_DAYS = 7;

// Most-urgent-first — the same order `getAttentionState` checks in. Shared so
// list sorting can't silently drift from what the state actually means.
const ATTENTION_PRIORITY: readonly AttentionState[] = [
  'blocked',
  'failing',
  'ready',
  'stale',
  'none'
];

export function attentionPriority(state: AttentionState): number {
  return ATTENTION_PRIORITY.indexOf(state);
}

/**
 * Derived purely from fields the enrichment step already fetches — no extra
 * API calls. Checked in priority order (most urgent first) since a PR can
 * match more than one row of the table this mirrors.
 *
 * `enrichment === 'pending'` means `ciStatus`/`reviewDecision` are still
 * placeholder values, so no state is derived yet — otherwise badges and
 * sorting would jump the instant enrichment lands.
 */
export function getAttentionState(
  pr: UnifiedPullRequest,
  staleDays: number = DEFAULT_STALE_DAYS,
  now: Date = new Date()
): AttentionState {
  if (pr.enrichment === 'pending') return 'none';

  const isAuthored = !pr.reviewRequestedFromMe;

  if (isAuthored && pr.reviewDecision === 'changes_requested') return 'blocked';
  if (pr.ciStatus === 'failure') return 'failing';
  if (pr.reviewDecision === 'approved' && pr.ciStatus === 'success' && !pr.draft) return 'ready';

  if (!pr.draft) {
    const ageMs = now.getTime() - new Date(pr.updatedAt).getTime();
    if (ageMs > staleDays * 24 * 60 * 60 * 1000) return 'stale';
  }

  return 'none';
}
