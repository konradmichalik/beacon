import type {
  NotificationSource,
  UnifiedIssue,
  UnifiedNotification,
  UnifiedPullRequest
} from '$lib/types';
import { getAttentionState } from './pr-attention';
import { isSyntheticNotification } from './synthetic-notifications';

export type ChipTone = 'success' | 'warning' | 'danger' | 'discovery' | 'brand' | 'neutral';
export type MetaTone = 'success' | 'warning' | 'danger' | 'subtle';

export type RowIcon =
  | 'merge'
  | 'eye'
  | 'at'
  | 'pen'
  | 'x'
  | 'check'
  | 'check-big'
  | 'shield'
  | 'message'
  | 'user-check'
  | 'users'
  | 'bell'
  | 'file-edit'
  | 'alert'
  | 'train'
  | 'user-plus'
  | 'pull-request'
  | 'loader'
  | 'branch';

export interface RowChip {
  readonly tone: ChipTone;
  readonly icon: RowIcon;
  readonly label: string;
  readonly tip?: string;
  readonly synthetic?: boolean;
  readonly clickable?: boolean;
}

export interface RowMeta {
  readonly icon: RowIcon;
  readonly text: string;
  readonly tip: string;
  readonly tone: MetaTone;
}

export interface PullRequestRow {
  readonly chips: readonly RowChip[];
  readonly metas: readonly RowMeta[];
  readonly pending: boolean;
}

export interface IssueRow {
  readonly labels: readonly string[];
  readonly extraLabels: number;
  readonly metas: readonly RowMeta[];
}

const MAX_LABELS = 2;

export function repoShortName(repository: string): string {
  return repository.split('/').slice(-2).join('/');
}

export function pullRequestRef(source: NotificationSource, number: number): string {
  return `${source === 'gitlab' ? '!' : '#'}${number}`;
}

type ReasonChip = Pick<RowChip, 'tone' | 'icon' | 'label'>;

const REASONS: Record<string, ReasonChip> = {
  mergeable: { tone: 'success', icon: 'merge', label: 'Ready to merge' },
  approved: { tone: 'success', icon: 'shield', label: 'Approved' },
  ci_failed: { tone: 'danger', icon: 'x', label: 'CI failed' },
  unmergeable: { tone: 'danger', icon: 'alert', label: 'Unmergeable' },
  security_alert: { tone: 'danger', icon: 'shield', label: 'Security alert' },
  change_requested: { tone: 'warning', icon: 'pen', label: 'Changes requested' },
  merge_train_removed: { tone: 'warning', icon: 'train', label: 'Merge train removed' },
  review_requested: { tone: 'brand', icon: 'eye', label: 'Review requested' },
  approval_requested: { tone: 'brand', icon: 'shield', label: 'Approval requested' },
  mention: { tone: 'brand', icon: 'at', label: 'Mentioned' },
  team_mention: { tone: 'brand', icon: 'users', label: 'Team mentioned' },
  ready_for_review: { tone: 'brand', icon: 'pull-request', label: 'Ready for review' },
  member_access_requested: { tone: 'brand', icon: 'user-plus', label: 'Access requested' },
  review_submitted: { tone: 'discovery', icon: 'eye', label: 'Review submitted' },
  comment: { tone: 'neutral', icon: 'message', label: 'Commented' },
  assign: { tone: 'neutral', icon: 'user-check', label: 'Assigned' },
  subscribed: { tone: 'neutral', icon: 'bell', label: 'Subscribed' },
  state_change: { tone: 'neutral', icon: 'pull-request', label: 'State changed' },
  ci_activity: { tone: 'neutral', icon: 'pull-request', label: 'CI activity' },
  author: { tone: 'neutral', icon: 'bell', label: 'Authored' }
};

function reasonChip(notification: UnifiedNotification): RowChip | null {
  const { reason } = notification;
  if (!reason) return null;
  const mapped: ReasonChip = REASONS[reason] ?? {
    tone: 'neutral',
    icon: 'bell',
    label: reason.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  };
  if (!isSyntheticNotification(notification)) return mapped;
  return { ...mapped, synthetic: true, tip: `${mapped.label}, detected by Beacon` };
}

function stateChip(notification: UnifiedNotification): RowChip | null {
  if (notification.subjectState === 'merged') {
    return { tone: 'discovery', icon: 'merge', label: 'Merged' };
  }
  if (notification.subjectState === 'closed') {
    return { tone: 'danger', icon: 'check', label: 'Closed' };
  }
  if (notification.draft) {
    return { tone: 'warning', icon: 'file-edit', label: 'Draft', tip: 'Draft, work in progress' };
  }
  return null;
}

/**
 * Open is the default and never shown. A neutral reason adds nothing next to a
 * state chip, so it is dropped there.
 */
export function notificationChips(notification: UnifiedNotification): RowChip[] {
  const reason = reasonChip(notification);
  const state = stateChip(notification);
  const keepReason = reason !== null && !(state !== null && reason.tone === 'neutral');
  return [...(keepReason ? [reason] : []), ...(state ? [state] : [])];
}

const DRAFT_CHIP: RowChip = {
  tone: 'warning',
  icon: 'file-edit',
  label: 'Draft',
  tip: 'Draft, work in progress'
};

function pullRequestStatusChip(pr: UnifiedPullRequest, now: Date): RowChip | null {
  if (pr.ciStatus === 'failure') {
    const name = pr.failingCheck?.name;
    return {
      tone: 'danger',
      icon: 'x',
      label: 'CI failed',
      tip: name ? `Open ${name}` : undefined,
      clickable: pr.failingCheck !== undefined
    };
  }
  if (!pr.reviewRequestedFromMe && pr.reviewDecision === 'changes_requested') {
    return { tone: 'warning', icon: 'pen', label: 'Changes requested' };
  }
  if (pr.reviewRequestedFromMe && !pr.reviewedByMe && pr.enrichment === 'enriched') {
    return { tone: 'brand', icon: 'eye', label: 'Your review' };
  }
  const ready =
    !pr.draft &&
    (pr.mergeStatus === 'mergeable' || getAttentionState(pr, undefined, now) === 'ready');
  if (ready) {
    return { tone: 'success', icon: 'merge', label: 'Ready to merge' };
  }
  if (getAttentionState(pr, undefined, now) === 'stale') {
    return { tone: 'neutral', icon: 'pull-request', label: 'Stale', tip: 'No activity in a while' };
  }
  return null;
}

function pullRequestMetas(pr: UnifiedPullRequest, statusChip: RowChip | null): RowMeta[] {
  const metas: RowMeta[] = [];

  if (pr.ciStatus === 'success') {
    metas.push({ icon: 'check', text: '', tip: 'CI passed', tone: 'success' });
  } else if (pr.ciStatus === 'pending') {
    metas.push({ icon: 'loader', text: '', tip: 'CI running', tone: 'warning' });
  }

  if (pr.reviewRequestedFromMe) {
    if (pr.reviewedByMe && pr.enrichment === 'enriched') {
      metas.push({
        icon: 'check-big',
        text: 'Reviewed',
        tip: 'You reviewed this',
        tone: 'success'
      });
    }
  } else if (pr.reviewDecision === 'approved') {
    metas.push({ icon: 'shield', text: 'Approved', tip: 'Approved', tone: 'success' });
  } else if (
    pr.reviewDecision === 'changes_requested' &&
    statusChip?.label !== 'Changes requested'
  ) {
    metas.push({
      icon: 'pen',
      text: 'Changes requested',
      tip: 'Changes requested',
      tone: 'warning'
    });
  } else if (pr.reviewDecision === 'review_required') {
    metas.push({ icon: 'eye', text: 'Review needed', tip: 'Review needed', tone: 'subtle' });
  }

  if (pr.baseBranch && pr.baseBranch !== 'main' && pr.baseBranch !== 'master') {
    metas.push({
      icon: 'branch',
      text: pr.baseBranch,
      tip: `Target: ${pr.baseBranch}`,
      tone: 'subtle'
    });
  }

  return metas;
}

/**
 * At most one status chip, then Draft. While enrichment is pending the CI and
 * review fields are placeholders, so nothing is derived and GitHub rows show a
 * skeleton instead of jumping when the data lands.
 */
export function pullRequestChips(pr: UnifiedPullRequest, now: Date = new Date()): PullRequestRow {
  if (pr.enrichment === 'pending') {
    return {
      chips: pr.draft ? [DRAFT_CHIP] : [],
      metas: [],
      pending: pr.source === 'github'
    };
  }
  const status = pullRequestStatusChip(pr, now);
  return {
    chips: [...(status ? [status] : []), ...(pr.draft ? [DRAFT_CHIP] : [])],
    metas: pullRequestMetas(pr, status),
    pending: false
  };
}

export function issueRow(issue: UnifiedIssue): IssueRow {
  const labels = issue.labels.slice(0, MAX_LABELS);
  const comments = issue.commentsCount ?? 0;
  return {
    labels,
    extraLabels: issue.labels.length - labels.length,
    metas:
      comments > 0
        ? [{ icon: 'message', text: String(comments), tip: `${comments} comments`, tone: 'subtle' }]
        : []
  };
}
