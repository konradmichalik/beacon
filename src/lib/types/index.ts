export type {
  NotificationSource,
  NotificationType,
  NotificationAuthor,
  SubjectState,
  UnifiedNotification,
  GitHubNotification,
  MuteRule
} from './notifications';

export { NOTIFICATION_TYPE_LABELS } from './notifications';

export type {
  ServiceId,
  GitHubConnectionConfig,
  GitLabConnectionConfig,
  StoredGitHubConnectionConfig,
  StoredGitLabConnectionConfig,
  ConnectionConfig,
  ConnectionStatus,
  ServiceState,
  AllConnectionsState,
  PlatformStatusIndicator,
  PlatformStatus
} from './connections';

export type {
  CIStatus,
  ReviewDecision,
  MergeStatus,
  PRRoleFilter,
  PRDraftFilter,
  PRCIFilter,
  PRMergeFilter,
  EnrichmentState,
  FailingCheck,
  UnifiedPullRequest
} from './pull-requests';

export type { IssueRole, IssueRoleFilter, UnifiedIssue } from './issues';

export type { ExportViewState, ExportView, ExportSnapshotV1 } from './export';

export type ViewTab = 'notifications' | 'pull-requests' | 'issues';
