import type { GitHubNotification, NotificationType } from '$lib/types';
import { safeFetch } from '$lib/utils/fetch';

const GITHUB_API = 'https://api.github.com';

export function mapSubjectType(type: string): NotificationType {
  switch (type) {
    case 'Issue':
      return 'issue';
    case 'PullRequest':
      return 'pull_request';
    case 'Release':
      return 'release';
    case 'Discussion':
      return 'discussion';
    default:
      return 'other';
  }
}

export function buildHtmlUrl(notification: GitHubNotification): string {
  const { subject, repository } = notification;

  if (subject.url) {
    const match = subject.url.match(/\/(issues|pulls)\/(\d+)$/);
    if (match) {
      const path = match[1] === 'pulls' ? 'pull' : match[1];
      return `${repository.html_url}/${path}/${match[2]}`;
    }
  }

  return repository.html_url;
}

export async function markGitHubThreadRead(token: string, threadId: string): Promise<void> {
  await safeFetch(`${GITHUB_API}/notifications/threads/${threadId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
}

export async function markGitHubThreadDone(token: string, threadId: string): Promise<void> {
  const response = await safeFetch(`${GITHUB_API}/notifications/threads/${threadId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (!response.ok) {
    throw new Error(`GitHub mark-done failed: HTTP ${response.status}`);
  }
}

export async function unsubscribeGitHubThread(token: string, threadId: string): Promise<void> {
  const response = await safeFetch(`${GITHUB_API}/notifications/threads/${threadId}/subscription`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ignored: true })
  });

  if (!response.ok) {
    throw new Error(`GitHub unsubscribe failed: HTTP ${response.status}`);
  }
}

export async function markAllGitHubNotificationsRead(token: string): Promise<void> {
  await safeFetch(`${GITHUB_API}/notifications`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ last_read_at: new Date().toISOString() })
  });
}
