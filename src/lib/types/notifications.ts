export type NotificationSource = 'github' | 'gitlab';

export type NotificationType =
  | 'issue'
  | 'pull_request'
  | 'merge_request'
  | 'review'
  | 'pipeline'
  | 'release'
  | 'discussion'
  | 'other';

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  issue: 'Issue',
  pull_request: 'PR',
  merge_request: 'MR',
  review: 'Review',
  pipeline: 'Pipeline',
  release: 'Release',
  discussion: 'Discussion',
  other: 'Other'
};

export interface NotificationAuthor {
  readonly login: string;
  readonly avatarUrl: string;
}

export type SubjectState = 'open' | 'closed' | 'merged' | null;

export interface UnifiedNotification {
  readonly id: string;
  readonly source: NotificationSource;
  readonly type: NotificationType;
  readonly title: string;
  readonly repository: string;
  readonly url: string;
  readonly reason: string;
  readonly unread: boolean;
  readonly updatedAt: string;
  readonly createdAt: string;
  readonly author: NotificationAuthor | null;
  readonly subjectState: SubjectState;
}

export interface GitHubNotification {
  readonly id: string;
  readonly unread: boolean;
  readonly reason: string;
  readonly updated_at: string;
  readonly subject: {
    readonly title: string;
    readonly url: string | null;
    readonly type: string;
    readonly latest_comment_url: string | null;
  };
  readonly repository: {
    readonly full_name: string;
    readonly html_url: string;
    readonly owner: {
      readonly login: string;
      readonly avatar_url: string;
    };
  };
}

export interface GitLabTodo {
  readonly id: number;
  readonly action_name: string;
  readonly target_type: string;
  readonly target_url: string;
  readonly body: string;
  readonly state: 'pending' | 'done';
  readonly created_at: string;
  readonly updated_at: string;
  readonly project: {
    readonly path_with_namespace: string;
    readonly web_url: string;
  };
  readonly target: {
    readonly title: string;
    readonly iid: number;
    readonly state?: string;
  };
  readonly author: {
    readonly username: string;
    readonly avatar_url: string;
  };
}

export interface NotificationGroup {
  readonly repository: string;
  readonly source: NotificationSource;
  readonly notifications: readonly UnifiedNotification[];
}
