import type { GitLabTodo, UnifiedNotification, NotificationType, SubjectState } from '$lib/types';
import { safeFetch } from '$lib/utils/fetch';

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

function mapToUnified(todo: GitLabTodo): UnifiedNotification {
  // Use the later of todo.updated_at and target.updated_at so the displayed
  // time reflects the most recent MR activity, not just when the todo was created.
  const targetUpdated = todo.target.updated_at;
  const effectiveUpdated =
    targetUpdated && targetUpdated > todo.updated_at ? targetUpdated : todo.updated_at;

  return {
    id: `gitlab-${todo.id}`,
    source: 'gitlab',
    type: mapTargetType(todo.target_type),
    title: todo.target.title,
    repository: todo.project.path_with_namespace,
    url: todo.target_url,
    reason: mapActionToReason(todo.action_name, todo.body),
    unread: todo.state === 'pending',
    updatedAt: effectiveUpdated,
    createdAt: todo.created_at,
    author: todo.author ? { login: todo.author.username, avatarUrl: todo.author.avatar_url } : null,
    subjectState: mapTargetState(todo.target.state)
  };
}

export async function fetchGitLabTodos(
  token: string,
  baseUrl: string
): Promise<UnifiedNotification[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/todos?state=pending&per_page=50`;
  const response = await safeFetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`GitLab API error: ${response.status}`);
  }

  const data: GitLabTodo[] = await response.json();
  return data.map(mapToUnified);
}

export async function markGitLabTodoDone(
  token: string,
  baseUrl: string,
  todoId: number
): Promise<void> {
  await safeFetch(`${baseUrl.replace(/\/$/, '')}/api/v4/todos/${todoId}/mark_as_done`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function markAllGitLabTodosDone(token: string, baseUrl: string): Promise<void> {
  await safeFetch(`${baseUrl.replace(/\/$/, '')}/api/v4/todos/mark_as_done`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}
