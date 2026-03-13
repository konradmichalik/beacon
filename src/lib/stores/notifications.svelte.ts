import type { UnifiedNotification, NotificationSource, NotificationType, NotificationGroup } from '$lib/types';
import type { SortMode, StatusFilter } from './filters.svelte';
import { isServiceConnected, getGitHubConfig, getGitLabConfig } from './connections.svelte';
import { fetchGitHubNotifications, markGitHubThreadRead } from '$lib/services/github/client';
import { fetchGitLabTodos, markGitLabTodoDone } from '$lib/services/gitlab/client';
import { settingsState } from './settings.svelte';
import { isTauri } from '$lib/utils/storage';

let notifications: UnifiedNotification[] = $state([]);
let isLoading = $state(false);
let lastRefresh: string | null = $state(null);
let pollingTimer: ReturnType<typeof setInterval> | null = null;
// Track IDs marked as read locally so refreshes don't revert them
const locallyReadIds = new Set<string>();

export function getNotifications(): readonly UnifiedNotification[] {
  return notifications;
}

export function getUnreadCount(): number {
  return notifications.filter((n) => n.unread).length;
}

export function getTotalCount(): number {
  return notifications.length;
}

export function getCountBySource(source: NotificationSource): number {
  return notifications.filter((n) => n.source === source && n.unread).length;
}

export function getIsLoading(): boolean {
  return isLoading;
}

export function getLastRefresh(): string | null {
  return lastRefresh;
}

export function getFilteredNotifications(
  sourceFilter: NotificationSource | 'all',
  projectFilter: string | null,
  sort: SortMode = 'date',
  typeFilter: ReadonlySet<NotificationType> = new Set(),
  projectsFilter: ReadonlySet<string> = new Set(),
  statusFilter: ReadonlySet<StatusFilter> = new Set()
): readonly UnifiedNotification[] {
  let filtered: UnifiedNotification[] = [...notifications];

  if (sourceFilter !== 'all') {
    filtered = filtered.filter((n) => n.source === sourceFilter);
  }
  if (projectFilter) {
    filtered = filtered.filter((n) => n.repository === projectFilter);
  }
  if (typeFilter.size > 0) {
    filtered = filtered.filter((n) => typeFilter.has(n.type));
  }
  if (projectsFilter.size > 0) {
    filtered = filtered.filter((n) => projectsFilter.has(n.repository));
  }
  if (statusFilter.size > 0) {
    filtered = filtered.filter((n) => {
      if (statusFilter.has('open') && (n.subjectState === 'open' || n.subjectState === null)) return true;
      if (statusFilter.has('closed') && (n.subjectState === 'closed' || n.subjectState === 'merged')) return true;
      return false;
    });
  }
  if (settingsState.hideClosed) {
    filtered = filtered.filter((n) => n.subjectState !== 'closed' && n.subjectState !== 'merged');
  }

  if (sort === 'project') {
    filtered.sort((a, b) => {
      const repoCmp = a.repository.localeCompare(b.repository);
      if (repoCmp !== 0) return repoCmp;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  return filtered;
}

export function getUniqueTypes(): readonly NotificationType[] {
  return [...new Set(notifications.map((n) => n.type))].sort();
}

export function getGroupedNotifications(
  sourceFilter: NotificationSource | 'all',
  projectFilter: string | null
): readonly NotificationGroup[] {
  let filtered = notifications;

  if (sourceFilter !== 'all') {
    filtered = filtered.filter((n) => n.source === sourceFilter);
  }
  if (projectFilter) {
    filtered = filtered.filter((n) => n.repository === projectFilter);
  }

  const grouped = new Map<string, { source: NotificationSource; items: UnifiedNotification[] }>();

  for (const notification of filtered) {
    const key = `${notification.source}:${notification.repository}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.items.push(notification);
    } else {
      grouped.set(key, { source: notification.source, items: [notification] });
    }
  }

  return Array.from(grouped.entries()).map(([, value]) => ({
    repository: value.items[0].repository,
    source: value.source,
    notifications: value.items
  }));
}

export interface ProjectInfo {
  readonly repository: string;
  readonly source: NotificationSource;
}

export function getUniqueProjects(): readonly string[] {
  return [...new Set(notifications.map((n) => n.repository))].sort();
}

export function getUniqueProjectsWithSource(): readonly ProjectInfo[] {
  const seen = new Map<string, NotificationSource>();
  for (const n of notifications) {
    if (!seen.has(n.repository)) {
      seen.set(n.repository, n.source);
    }
  }
  return [...seen.entries()]
    .map(([repository, source]) => ({ repository, source }))
    .sort((a, b) => a.repository.localeCompare(b.repository));
}

async function updateTrayBadge(count: number): Promise<void> {
  if (!isTauri()) return;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('update_badge', { count, mode: settingsState.badgeMode });
  } catch {
    // Badge update is best-effort — ignore failures
  }
}

export async function refreshNotifications(): Promise<void> {
  if (isLoading) return;
  isLoading = true;

  try {
    const results: UnifiedNotification[] = [];

    // Fetch from both services in parallel
    const promises: Promise<void>[] = [];

    if (isServiceConnected('github')) {
      const config = getGitHubConfig();
      if (config) {
        promises.push(
          fetchGitHubNotifications(config.token)
            .then((items) => { results.push(...items); })
            .catch(() => {
              // Silently skip failed service — don't break the other
            })
        );
      }
    }

    if (isServiceConnected('gitlab')) {
      const config = getGitLabConfig();
      if (config) {
        promises.push(
          fetchGitLabTodos(config.token, config.baseUrl)
            .then((items) => { results.push(...items); })
            .catch(() => {
              // Silently skip failed service
            })
        );
      }
    }

    await Promise.all(promises);

    // Filter out own notifications
    const githubUsername = getGitHubConfig()?.username;
    const gitlabUsername = getGitLabConfig()?.username;
    const filtered = results.filter((n) => {
      if (!n.author) return true;
      if (n.source === 'github' && githubUsername && n.author.login === githubUsername) return false;
      if (n.source === 'gitlab' && gitlabUsername && n.author.login === gitlabUsername) return false;
      return true;
    });

    // Sort by updatedAt descending
    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Preserve locally-read state across refreshes
    const refreshedIds = new Set(filtered.map((n) => n.id));
    // Clean up IDs no longer in the list (server confirmed read or notification gone)
    for (const id of locallyReadIds) {
      if (!refreshedIds.has(id)) locallyReadIds.delete(id);
    }
    // Apply local read state
    notifications = filtered.map((n) =>
      locallyReadIds.has(n.id) ? { ...n, unread: false } : n
    );
    lastRefresh = new Date().toISOString();

    // Update tray badge based on the final (locally-adjusted) list
    const unreadCount = notifications.filter((n) => n.unread).length;
    await updateTrayBadge(unreadCount);
  } finally {
    isLoading = false;
  }
}

export function startPolling(): void {
  stopPolling();
  refreshNotifications();
  pollingTimer = setInterval(refreshNotifications, settingsState.pollingInterval * 1000);
}

export function stopPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

export function restartPolling(): void {
  startPolling();
}

export function refreshBadge(): void {
  const unreadCount = notifications.filter((n) => n.unread).length;
  updateTrayBadge(unreadCount);
}

export function markAsRead(id: string): void {
  const notification = notifications.find((n) => n.id === id);
  if (!notification || !notification.unread) return;

  // Mark as read locally and remember across refreshes
  locallyReadIds.add(id);
  notifications = notifications.map((n) => (n.id === id ? { ...n, unread: false } : n));
  const unreadCount = notifications.filter((n) => n.unread).length;
  updateTrayBadge(unreadCount);

  // Mark as read on the server (best-effort, don't block UI)
  if (notification.source === 'github') {
    const config = getGitHubConfig();
    const threadId = id.replace('github-', '');
    if (config) {
      markGitHubThreadRead(config.token, threadId).catch(() => {});
    }
  } else if (notification.source === 'gitlab') {
    const config = getGitLabConfig();
    const todoId = Number(id.replace('gitlab-', ''));
    if (config) {
      markGitLabTodoDone(config.token, config.baseUrl, todoId).catch(() => {});
    }
  }
}
