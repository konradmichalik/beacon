import { buildExportSnapshot } from './export-snapshot';
import type { ExportSnapshotInput } from './export-snapshot';
import type { ExportSnapshotV1 } from '$lib/types';

export interface ExportDecisionInput extends ExportSnapshotInput {
  readonly exportEnabled: boolean;
}

export type ExportDecision =
  | { readonly action: 'skip'; readonly reason: string }
  | { readonly action: 'write'; readonly snapshot: ExportSnapshotV1 };

/**
 * Pure decision step between the reactive store state and the actual write
 * (GH-127): given exactly why a write did or did not happen, the caller can
 * log a specific, testable reason instead of the feature silently doing
 * nothing.
 */
export function decideExport(input: ExportDecisionInput): ExportDecision {
  if (!input.exportEnabled) {
    return { action: 'skip', reason: 'export disabled' };
  }
  if (!input.notificationsLoaded) {
    return { action: 'skip', reason: 'notifications not loaded yet' };
  }
  if (!input.prsLoaded) {
    return { action: 'skip', reason: 'pull requests not loaded yet' };
  }
  if (input.issuesEnabled && !input.issuesLoaded) {
    return { action: 'skip', reason: 'issues not loaded yet' };
  }

  const snapshot = buildExportSnapshot(input);
  if (!snapshot) {
    return { action: 'skip', reason: 'snapshot unavailable' };
  }
  return { action: 'write', snapshot };
}
