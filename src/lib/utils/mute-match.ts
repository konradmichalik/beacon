import type { MuteRule, UnifiedNotification } from '$lib/types';

export type MuteCriteria = Omit<MuteRule, 'id' | 'createdAt'>;

/** Every criterion that is set must match; criteria that are not set are ignored. */
export function matchesMuteCriteria(
  criteria: MuteCriteria,
  notification: UnifiedNotification
): boolean {
  if (criteria.project !== undefined && criteria.project !== notification.repository) return false;
  if (criteria.type !== undefined && criteria.type !== notification.type) return false;
  if (criteria.status !== undefined && criteria.status !== notification.subjectState) return false;
  if (criteria.author !== undefined && criteria.author !== notification.author?.login) return false;
  return true;
}

export function countMuteMatches(
  criteria: MuteCriteria,
  notifications: readonly UnifiedNotification[]
): number {
  return notifications.filter((n) => matchesMuteCriteria(criteria, n)).length;
}
