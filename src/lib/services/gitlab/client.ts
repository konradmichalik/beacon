import type { NotificationType, SubjectState } from '$lib/types';
import { safeFetch } from '$lib/utils/fetch';
import { error as logError, info as logInfo } from '$lib/utils/logger';

export function mapTargetType(type: string): NotificationType {
  switch (type) {
    case 'Issue':
      return 'issue';
    case 'MergeRequest':
      return 'merge_request';
    case 'Pipeline':
      return 'pipeline';
    default:
      return 'other';
  }
}

export function mapActionToReason(action: string, body: string): string {
  switch (action) {
    case 'assigned':
      return 'assign';
    case 'mentioned':
    case 'directly_addressed':
      return 'mention';
    case 'build_failed':
      return 'ci_activity';
    case 'marked':
    case 'review_requested':
      return 'review_requested';
    case 'approval_required':
      return 'approval_requested';
    case 'approved':
      return 'approved';
    case 'review_submitted': {
      if (!body.trim()) return 'approved';
      const lower = body.toLowerCase();
      if (lower.includes('requested changes') || lower.includes('change'))
        return 'change_requested';
      return 'review_submitted';
    }
    case 'change_requested':
      return 'change_requested';
    case 'unmergeable':
      return 'unmergeable';
    case 'merge_train_removed':
      return 'merge_train_removed';
    case 'member_access_requested':
      return 'member_access_requested';
    default:
      return action;
  }
}

export function mapTargetState(state?: string): SubjectState {
  if (state === 'merged') return 'merged';
  if (state === 'closed') return 'closed';
  if (state === 'opened') return 'open';
  return null;
}

export async function markGitLabTodoDone(
  token: string,
  baseUrl: string,
  todoId: number
): Promise<void> {
  const response = await safeFetch(
    `${baseUrl.replace(/\/$/, '')}/api/v4/todos/${todoId}/mark_as_done`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    logError('gitlab', `mark todo ${todoId} as done failed: HTTP ${response.status}`);
    throw new Error(`GitLab mark_as_done failed: ${response.status}`);
  }
  logInfo('gitlab', `marked todo ${todoId} as done`);
}

export async function unsubscribeGitLabTarget(
  token: string,
  baseUrl: string,
  projectPath: string,
  targetType: 'merge_requests' | 'issues',
  iid: number
): Promise<void> {
  const response = await safeFetch(
    `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${encodeURIComponent(projectPath)}/${targetType}/${iid}/unsubscribe`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    logError('gitlab', `unsubscribe from ${targetType}/${iid} failed: HTTP ${response.status}`);
    throw new Error(`GitLab unsubscribe failed: ${response.status}`);
  }
  logInfo('gitlab', `unsubscribed from ${targetType}/${iid}`);
}

export async function markAllGitLabTodosDone(token: string, baseUrl: string): Promise<void> {
  const response = await safeFetch(`${baseUrl.replace(/\/$/, '')}/api/v4/todos/mark_as_done`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    logError('gitlab', `mark all todos as done failed: HTTP ${response.status}`);
    throw new Error(`GitLab mark_all_as_done failed: ${response.status}`);
  }
  logInfo('gitlab', 'marked all todos as done');
}
