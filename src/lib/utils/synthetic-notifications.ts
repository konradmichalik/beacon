import type { UnifiedNotification } from '$lib/types';
import type { PRTransition, PRTransitionKind } from './pr-transitions';

const SYNTHETIC_ID_PREFIX = 'beacon:';

const TRANSITION_SLUG: Record<PRTransitionKind, string> = {
  ready_for_review: 'pr-ready',
  mergeable: 'pr-mergeable'
};

/**
 * Real notification ids are always `github-<threadId>` or `gitlab-<todoId>`
 * (see the `replace('github-', ...)` / `replace('gitlab-', ...)` calls in
 * notifications.svelte.ts), so this prefix can never collide with one, and is
 * deterministic per PR and transition kind so the same event always maps to
 * the same entry.
 */
export function syntheticNotificationId(kind: PRTransitionKind, prId: string): string {
  return `${SYNTHETIC_ID_PREFIX}${TRANSITION_SLUG[kind]}:${prId}`;
}

/**
 * Checks the id prefix in addition to the flag, so a copy that lost
 * `synthetic: true` (stale persisted JSON, a spread that dropped it) still
 * can't slip past the guards in notifications.svelte.ts that keep synthetic
 * entries away from GitHub/GitLab API calls.
 */
export function isSyntheticNotification(notification: UnifiedNotification): boolean {
  return notification.synthetic === true || notification.id.startsWith(SYNTHETIC_ID_PREFIX);
}

/** Inverse of `syntheticNotificationId`, used to check a PR is still open. */
export function syntheticNotificationPrId(id: string): string {
  return id.split(':').slice(2).join(':');
}

export function buildSyntheticNotification(
  transition: PRTransition,
  now: Date
): UnifiedNotification {
  const { kind, pr } = transition;
  return {
    id: syntheticNotificationId(kind, pr.id),
    source: pr.source,
    type: pr.source === 'github' ? 'pull_request' : 'merge_request',
    title: pr.title,
    repository: pr.repository,
    url: pr.url,
    reason: kind,
    unread: true,
    updatedAt: now.toISOString(),
    createdAt: pr.createdAt,
    author: pr.author,
    subjectState: 'open',
    draft: pr.draft,
    synthetic: true
  };
}
