import type { NotificationSource, NotificationAuthor } from './notifications';

export type CIStatus = 'pending' | 'success' | 'failure' | 'unknown';
export type ReviewDecision = 'approved' | 'changes_requested' | 'review_required';
export type PRRoleFilter = 'all' | 'authored' | 'review_requested';
export type PRDraftFilter = 'all' | 'ready' | 'draft';
export type PRCIFilter = 'all' | 'success' | 'failure' | 'pending';
export type EnrichmentState = 'pending' | 'enriched' | 'skipped';

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
  readonly reviewRequestedFromMe: boolean;
  readonly reviewedByMe: boolean;
  readonly enrichment: EnrichmentState;
  readonly sourceMetadata?: Readonly<Record<string, number | string>>;
}
