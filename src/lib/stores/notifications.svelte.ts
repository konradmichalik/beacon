import type {
  UnifiedNotification,
  NotificationSource,
  NotificationType,
  NotificationGroup
} from '$lib/types';
import type { SortMode, StatusFilter } from './filters.svelte';
import { settingsState } from './settings.svelte';
import { isTauri } from '$lib/utils/storage';
import { demoNotifications } from '$lib/utils/demo-data';
import { playNotificationSound } from '$lib/services/notification-sound';

let notifications: UnifiedNotification[] = $state([]);
let isLoading = $state(false);
let lastRefresh: string | null = $state(null);
// Track IDs marked as read locally so refreshes don't revert them
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state, internal bookkeeping
const locallyReadIds = new Set<string>();
// Timestamp of the last time the user opened the popup
let lastSeenAt: string | null = $state(null);

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

export function getLastSeenAt(): string | null {
  return lastSeenAt;
}

export function markAllSeen(): void {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- timestamp string, not reactive Date
  lastSeenAt = new Date().toISOString();
}

export function getFilteredNotifications(
  sourceFilter: NotificationSource | 'all',
  projectFilter: string | null,
  sort: SortMode = 'date',
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- default param, not state
  typeFilter: ReadonlySet<NotificationType> = new Set(),
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- default param, not state
  projectsFilter: ReadonlySet<string> = new Set(),
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- default param, not state
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
      if (statusFilter.has('open') && (n.subjectState === 'open' || n.subjectState === null))
        return true;
      if (
        statusFilter.has('closed') &&
        (n.subjectState === 'closed' || n.subjectState === 'merged')
      )
        return true;
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
      // eslint-disable-next-line svelte/prefer-svelte-reactivity -- date parsing for sort comparison
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  return filtered;
}

export function getUniqueTypes(): readonly NotificationType[] {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- ephemeral dedup, not state
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

  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local grouping map, not state
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
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- ephemeral dedup, not state
  return [...new Set(notifications.map((n) => n.repository))].sort();
}

export function getUniqueProjectsWithSource(): readonly ProjectInfo[] {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup map, not state
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

async function tauriInvoke(cmd: string, args?: Record<string, unknown>): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke(cmd, args);
}

async function updateTrayBadge(count: number): Promise<void> {
  try {
    await tauriInvoke('update_badge', {
      count,
      mode: settingsState.badgeMode,
      dotColor: settingsState.dotColor
    });
  } catch {
    // Badge update is best-effort
  }
}

// ── Backend event listener ──────────────────────────────────────

let knownUnreadIds = new Set<string>();
let isFirstLoad = true;

function updateFromBackend(items: UnifiedNotification[]): void {
  // Clean up locally-read IDs no longer in the list
  const ids = new Set(items.map((n) => n.id));
  for (const id of locallyReadIds) {
    if (!ids.has(id)) locallyReadIds.delete(id);
  }

  // Apply local read state overlay
  const effectiveItems = items.map((n) => (locallyReadIds.has(n.id) ? { ...n, unread: false } : n));

  // Detect genuinely new unread notifications for sound playback
  const currentUnreadIds = new Set(effectiveItems.filter((n) => n.unread).map((n) => n.id));
  if (!isFirstLoad && settingsState.notifyMode !== 'disabled') {
    const hasNew = [...currentUnreadIds].some((id) => !knownUnreadIds.has(id));
    if (hasNew) {
      playNotificationSound(settingsState.notifySound);
    }
  }
  knownUnreadIds = currentUnreadIds;
  isFirstLoad = false;

  notifications = effectiveItems;
  lastRefresh = new Date().toISOString();

  // Update badge accounting for locally-read items
  const unreadCount = notifications.filter((n) => n.unread).length;
  updateTrayBadge(unreadCount);
}

export async function setupNotificationListener(): Promise<() => void> {
  if (!isTauri()) return () => {};

  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<UnifiedNotification[]>('notifications-updated', (event) => {
    updateFromBackend(event.payload);
  });
  return unlisten;
}

// ── Polling (delegates to Rust backend) ─────────────────────────

export async function startPolling(): Promise<void> {
  try {
    await tauriInvoke('start_polling');
  } catch {
    // best-effort
  }
}

export async function stopPolling(): Promise<void> {
  try {
    await tauriInvoke('stop_polling');
  } catch {
    // best-effort
  }
}

export function restartPolling(): void {
  startPolling();
}

export async function refreshNotifications(): Promise<void> {
  if (isLoading) return;
  isLoading = true;
  try {
    await tauriInvoke('trigger_poll');
  } finally {
    isLoading = false;
  }
}

export function refreshBadge(): void {
  const unreadCount = notifications.filter((n) => n.unread).length;
  updateTrayBadge(unreadCount);
}

// ── Demo mode ───────────────────────────────────────────────────

declare const __DEMO_MODE__: boolean;

export function isDemoMode(): boolean {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- one-time URL check, not state
  return __DEMO_MODE__ || new URLSearchParams(window.location.search).has('demo');
}

export function loadDemoData(): void {
  notifications = [...demoNotifications];
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- timestamp string, not reactive Date
  lastRefresh = new Date().toISOString();
}

// ── Mark as read/unread ─────────────────────────────────────────

export function markAllAsRead(ids?: ReadonlySet<string>): void {
  const unread = notifications.filter((n) => n.unread && (!ids || ids.has(n.id)));
  if (unread.length === 0) return;

  for (const n of unread) {
    locallyReadIds.add(n.id);
  }
  notifications = notifications.map((n) =>
    n.unread && (!ids || ids.has(n.id)) ? { ...n, unread: false } : n
  );
  const unreadCount = notifications.filter((n) => n.unread).length;
  updateTrayBadge(unreadCount);

  // Mark on servers (best-effort)
  markOnServers(unread).catch(() => {});
}

export function markAsUnread(id: string): void {
  const notification = notifications.find((n) => n.id === id);
  if (!notification || notification.unread) return;

  locallyReadIds.delete(id);
  notifications = notifications.map((n) => (n.id === id ? { ...n, unread: true } : n));
  const unreadCount = notifications.filter((n) => n.unread).length;
  updateTrayBadge(unreadCount);
}

export function markAsRead(id: string): void {
  const notification = notifications.find((n) => n.id === id);
  if (!notification || !notification.unread) return;

  locallyReadIds.add(id);
  notifications = notifications.map((n) => (n.id === id ? { ...n, unread: false } : n));
  const unreadCount = notifications.filter((n) => n.unread).length;
  updateTrayBadge(unreadCount);

  markOnServers([notification]).catch(() => {});
}

// ── Server-side mark helper ─────────────────────────────────────

async function markOnServers(items: UnifiedNotification[]): Promise<void> {
  const { getGitHubConfig, getGitLabConfig } = await import('./connections.svelte');
  const { markGitHubThreadRead } = await import('$lib/services/github/client');
  const { markGitLabTodoDone } = await import('$lib/services/gitlab/client');

  const ghConfig = getGitHubConfig();
  const glConfig = getGitLabConfig();

  for (const n of items) {
    if (n.source === 'github' && ghConfig) {
      markGitHubThreadRead(ghConfig.token, n.id.replace('github-', '')).catch(() => {});
    } else if (n.source === 'gitlab' && glConfig) {
      markGitLabTodoDone(
        glConfig.token,
        glConfig.baseUrl,
        Number(n.id.replace('gitlab-', ''))
      ).catch(() => {});
    }
  }
}
