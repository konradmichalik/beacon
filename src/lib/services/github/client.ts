import type { GitHubNotification, UnifiedNotification, NotificationType, SubjectState, NotificationAuthor } from '$lib/types';

const GITHUB_API = 'https://api.github.com';

function mapSubjectType(type: string): NotificationType {
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

function buildHtmlUrl(notification: GitHubNotification): string {
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

interface SubjectDetails {
  state: SubjectState;
  author: NotificationAuthor | null;
}

async function fetchSubjectDetails(subjectUrl: string, token: string): Promise<SubjectDetails> {
  try {
    const response = await fetch(subjectUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!response.ok) return { state: null, author: null };

    const data = await response.json() as Record<string, unknown>;

    let state: SubjectState = null;
    if (data.state === 'closed' && data.merged === true) {
      state = 'merged';
    } else if (data.state === 'closed') {
      state = 'closed';
    } else if (data.state === 'open') {
      state = 'open';
    }

    let author: NotificationAuthor | null = null;
    const user = data.user as Record<string, unknown> | undefined;
    if (user?.login && user?.avatar_url) {
      author = { login: user.login as string, avatarUrl: user.avatar_url as string };
    }

    return { state, author };
  } catch {
    return { state: null, author: null };
  }
}

export async function fetchGitHubNotifications(token: string): Promise<UnifiedNotification[]> {
  const response = await fetch(`${GITHUB_API}/notifications?participating=false&all=false`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data: GitHubNotification[] = await response.json();

  // Enrich with subject details (state + author) in parallel
  const enriched = await Promise.all(
    data.map(async (notification): Promise<UnifiedNotification> => {
      const details = notification.subject.url
        ? await fetchSubjectDetails(notification.subject.url, token)
        : { state: null as SubjectState, author: null as NotificationAuthor | null };

      return {
        id: `github-${notification.id}`,
        source: 'github',
        type: mapSubjectType(notification.subject.type),
        title: notification.subject.title,
        repository: notification.repository.full_name,
        url: buildHtmlUrl(notification),
        reason: notification.reason,
        unread: notification.unread,
        updatedAt: notification.updated_at,
        createdAt: notification.updated_at,
        author: details.author,
        subjectState: details.state
      };
    })
  );

  return enriched;
}

export async function markGitHubThreadRead(token: string, threadId: string): Promise<void> {
  await fetch(`${GITHUB_API}/notifications/threads/${threadId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
}
