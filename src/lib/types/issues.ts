import type { NotificationSource, NotificationAuthor } from './notifications';

export type IssueRole = 'authored' | 'assigned';
export type IssueRoleFilter = 'all' | 'authored' | 'assigned';

export interface UnifiedIssue {
  readonly id: string;
  readonly source: NotificationSource;
  readonly title: string;
  readonly repository: string;
  readonly url: string;
  readonly number: number;
  readonly author: NotificationAuthor | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly role: IssueRole;
  readonly labels: readonly string[];
  readonly commentsCount?: number;
}
