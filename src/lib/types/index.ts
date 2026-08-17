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
  ConnectionConfig,
  ConnectionStatus,
  ServiceState,
  AllConnectionsState
} from './connections';

export type {
  CIStatus,
  ReviewDecision,
  PRRoleFilter,
  PRDraftFilter,
  PRCIFilter,
  EnrichmentState,
  FailingCheck,
  UnifiedPullRequest
} from './pull-requests';

export type { IssueRole, IssueRoleFilter, UnifiedIssue } from './issues';

export type ViewTab = 'notifications' | 'pull-requests' | 'issues';
