import type {
  ExportSnapshotV1,
  ExportView,
  NotificationSource,
  UnifiedNotification,
  UnifiedPullRequest,
  UnifiedIssue
} from '$lib/types';

const SCHEMA_VERSION = 1;
const APP_SLUG = 'beacon';
const STALE_REVIEW_MS = 24 * 60 * 60 * 1000;

export interface ExportSnapshotInput {
  readonly displayName: string;
  readonly ttlSeconds: number;
  readonly notificationsLoaded: boolean;
  readonly filteredNotifications: readonly UnifiedNotification[];
  readonly prsLoaded: boolean;
  readonly filteredPRs: readonly UnifiedPullRequest[];
  readonly issuesEnabled: boolean;
  readonly issuesLoaded: boolean;
  readonly filteredIssues: readonly UnifiedIssue[];
  readonly now?: Date;
}

function sourceLabel(source: NotificationSource): string {
  return source === 'github' ? 'GitHub' : 'GitLab';
}

function unreadView(notifications: readonly UnifiedNotification[]): ExportView {
  const unread = notifications.filter((n) => n.unread);

  const bySource = new Map<NotificationSource, number>();
  for (const n of unread) {
    bySource.set(n.source, (bySource.get(n.source) ?? 0) + 1);
  }
  const detail = [...bySource.entries()]
    .map(([source, count]) => `${count} ${sourceLabel(source)}`)
    .join(', ');
  return {
    id: 'unread',
    label: 'Inbox',
    value: String(unread.length),
    detail: detail || undefined,
    state: unread.length > 0 ? 'warn' : 'idle'
  };
}

function reviewsView(prs: readonly UnifiedPullRequest[], now: Date): ExportView {
  const requested = prs.filter((pr) => pr.reviewRequestedFromMe);
  const oldest = [...requested].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )[0];
  const isStale = oldest
    ? now.getTime() - new Date(oldest.createdAt).getTime() > STALE_REVIEW_MS
    : false;
  return {
    id: 'reviews',
    label: 'Review',
    value: String(requested.length),
    detail: oldest?.repository,
    state: requested.length === 0 ? 'idle' : isStale ? 'warn' : 'ok'
  };
}

function mineView(prs: readonly UnifiedPullRequest[]): ExportView {
  const mine = prs.filter((pr) => !pr.reviewRequestedFromMe);
  const failing = mine.filter((pr) => pr.ciStatus === 'failure').length;
  const mergeable = mine.filter((pr) => pr.mergeStatus === 'mergeable').length;
  const detailParts: string[] = [];
  if (failing > 0) detailParts.push(`${failing} red`);
  if (mergeable > 0) detailParts.push(`${mergeable} mergeable`);
  return {
    id: 'mine',
    label: 'Mine',
    value: String(mine.length),
    detail: detailParts.length > 0 ? detailParts.join(', ') : undefined,
    state: mine.length === 0 ? 'idle' : failing > 0 ? 'critical' : 'ok'
  };
}

function issuesView(issues: readonly UnifiedIssue[]): ExportView {
  return {
    id: 'issues',
    label: 'Issues',
    value: String(issues.length),
    detail: 'assigned',
    state: issues.length > 0 ? 'ok' : 'idle'
  };
}

/**
 * Pure serializer for the schema-v1 export snapshot (see GH-124). Callers own
 * applying the active filter bar/popover state to each list before calling
 * this — it only aggregates and formats what it is handed.
 */
export function buildExportSnapshot(input: ExportSnapshotInput): ExportSnapshotV1 | null {
  if (!input.notificationsLoaded || !input.prsLoaded) return null;
  if (input.issuesEnabled && !input.issuesLoaded) return null;

  const now = input.now ?? new Date();
  const views: ExportView[] = [
    unreadView(input.filteredNotifications),
    reviewsView(input.filteredPRs, now),
    mineView(input.filteredPRs)
  ];
  if (input.issuesEnabled) {
    views.push(issuesView(input.filteredIssues));
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    app: APP_SLUG,
    displayName: input.displayName,
    updatedAt: now.toISOString(),
    ttlSeconds: input.ttlSeconds,
    views
  };
}
