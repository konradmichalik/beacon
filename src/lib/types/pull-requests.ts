import type { NotificationSource, NotificationAuthor } from './notifications';

export type CIStatus = 'pending' | 'success' | 'failure' | 'unknown';
export type ReviewDecision = 'approved' | 'changes_requested' | 'review_required';
export type MergeStatus = 'mergeable' | 'blocked' | 'unknown';
export type PRRoleFilter = 'all' | 'authored' | 'review_requested';
export type PRDraftFilter = 'all' | 'ready' | 'draft';
export type PRCIFilter = 'all' | 'success' | 'failure' | 'pending';
export type PRMergeFilter = 'all' | 'mergeable';
export type EnrichmentState = 'pending' | 'enriched' | 'skipped';

export interface FailingCheck {
  readonly name: string;
  readonly url: string;
}

export interface UnifiedPullRequest {
  readonly id: string;
  readonly source: NotificationSource;
  readonly title: string;
  readonly repository: string;
  readonly url: string;
  readonly number: number;
  readonly draft: boolean;
  readonly author: NotificationAuthor | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly ciStatus: CIStatus;
  readonly reviewDecision: ReviewDecision | null;
  readonly mergeStatus: MergeStatus;
  readonly reviewRequestedFromMe: boolean;
  readonly reviewedByMe: boolean;
  readonly baseBranch?: string;
  readonly failingCheck?: FailingCheck;
  readonly enrichment: EnrichmentState;
  readonly sourceMetadata?: Readonly<Record<string, number | string>>;
}
