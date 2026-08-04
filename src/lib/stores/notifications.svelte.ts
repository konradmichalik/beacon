import type {
  UnifiedNotification,
  NotificationSource,
  NotificationType,
  NotificationGroup
} from '$lib/types';
import type { SortMode, StatusFilter, NotificationDraftFilter } from './filters.svelte';
import { filterState } from './filters.svelte';
import { settingsState } from './settings.svelte';
import { isNotificationMuted } from './mute-rules.svelte';
import { isTauri, getStorageItem, setStorageItem } from '$lib/utils/storage';
import { demoNotifications } from '$lib/utils/demo-data';
import { playNotificationSound } from '$lib/services/notification-sound';
import { showToast } from '$lib/stores/toast.svelte';

let notifications: UnifiedNotification[] = $state([]);
let isLoading = $state(false);
let hasLoadedOnce = $state(false);
let lastRefresh: string | null = $state(null);
// Track IDs marked as read locally so refreshes don't revert them.
// Persisted as { [id]: timestamp } so stale entries can be pruned.
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state, internal bookkeeping
const locallyReadIds = new Map<string, number>();
const READ_IDS_STORAGE_KEY = 'locallyReadIds';
const READ_IDS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persistReadIds(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const obj = Object.fromEntries(locallyReadIds);
    setStorageItem(READ_IDS_STORAGE_KEY, obj).catch(() => {});
  }, 500);
}

export async function loadPersistedReadIds(): Promise<void> {
  const stored = await getStorageItem<Record<string, number>>(READ_IDS_STORAGE_KEY);
  if (!stored) return;
  const now = Date.now();
  for (const [id, ts] of Object.entries(stored)) {
    if (now - ts < READ_IDS_MAX_AGE_MS) {
      locallyReadIds.set(id, ts);
    }
  }
}

// Timestamp of the last time the user opened the popup
let lastSeenAt: string | null = $state(null);

export function getNotifications(): readonly UnifiedNotification[] {
  return notifications;
}

export function getUnreadCount(): number {
  return notifications.filter((n) => n.unread).length;
}

/**
 * Unread count for the tray icon. Muted notifications are hidden from the list,
 * so they must not light up the menu bar indicator either — otherwise the
 * indicator stays lit with nothing to show behind it.
 */
export function countBadgeUnread(items: readonly UnifiedNotification[]): number {
  return items.filter((n) => n.unread && !isNotificationMuted(n)).length;
}

export function getFilteredUnreadCount(): number {
  return getFilteredNotifications(
    'all',
    filterState.project,
    'date',
    filterState.types,
    filterState.projects,
    filterState.statuses,
    filterState.authors,
    filterState.draftFilter
  ).filter((n) => n.unread).length;
}

export function getTotalCount(): number {
  return notifications.length;
}

export function getCountBySource(source: NotificationSource): number {
  return getFilteredNotifications(
    source,
    filterState.project,
    'date',
    filterState.types,
    filterState.projects,
    filterState.statuses,
    filterState.authors,
    filterState.draftFilter
  ).filter((n) => n.unread).length;
}

export function getIsLoading(): boolean {
  return isLoading;
}

export function getHasLoadedOnce(): boolean {
  return hasLoadedOnce;
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
  statusFilter: ReadonlySet<StatusFilter> = new Set(),
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- default param, not state
  authorsFilter: ReadonlySet<string> = new Set(),
  draftFilter: NotificationDraftFilter = 'all'
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
  if (authorsFilter.size > 0) {
    filtered = filtered.filter((n) => n.author !== null && authorsFilter.has(n.author.login));
  }
  if (draftFilter === 'ready') {
    filtered = filtered.filter((n) => n.draft === false);
  } else if (draftFilter === 'draft') {
    filtered = filtered.filter((n) => n.draft === true);
  }
  filtered = filtered.filter((n) => !isNotificationMuted(n));

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

export function getUnreadCountByType(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<NotificationType, number> {
  const sourceOk = sourceFilter === 'all';
  const filtered = notifications.filter(
    (n) => n.unread && !isNotificationMuted(n) && (sourceOk || n.source === sourceFilter)
  );
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local counting map, not state
  const counts = new Map<NotificationType, number>();
  for (const n of filtered) {
    counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
  }
  return counts;
}

export function getUnreadCountByStatus(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<StatusFilter, number> {
  const sourceOk = sourceFilter === 'all';
  const filtered = notifications.filter(
    (n) => n.unread && !isNotificationMuted(n) && (sourceOk || n.source === sourceFilter)
  );
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local counting map, not state
  const counts = new Map<StatusFilter, number>();
  for (const n of filtered) {
    const key: StatusFilter =
      n.subjectState === 'closed' || n.subjectState === 'merged' ? 'closed' : 'open';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function getUnreadCountByDraft(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<NotificationDraftFilter, number> {
  const sourceOk = sourceFilter === 'all';
  const filtered = notifications.filter(
    (n) => n.unread && !isNotificationMuted(n) && (sourceOk || n.source === sourceFilter)
  );
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local counting map, not state
  const counts = new Map<NotificationDraftFilter, number>();
  for (const n of filtered) {
    if (n.draft === true) {
      counts.set('draft', (counts.get('draft') ?? 0) + 1);
    } else if (n.draft === false) {
      counts.set('ready', (counts.get('ready') ?? 0) + 1);
    }
  }
  return counts;
}

export function getUnreadCountByProject(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<string, number> {
  const sourceOk = sourceFilter === 'all';
  const filtered = notifications.filter(
    (n) => n.unread && !isNotificationMuted(n) && (sourceOk || n.source === sourceFilter)
  );
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local counting map, not state
  const counts = new Map<string, number>();
  for (const n of filtered) {
    counts.set(n.repository, (counts.get(n.repository) ?? 0) + 1);
  }
  return counts;
}

export interface AuthorInfo {
  readonly login: string;
  readonly avatarUrl: string;
}

export function getUniqueAuthors(): readonly AuthorInfo[] {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local dedup map, not state
  const seen = new Map<string, string>();
  for (const n of notifications) {
    if (n.author && !seen.has(n.author.login)) {
      seen.set(n.author.login, n.author.avatarUrl);
    }
  }
  return [...seen.entries()]
    .map(([login, avatarUrl]) => ({ login, avatarUrl }))
    .sort((a, b) => a.login.localeCompare(b.login));
}

export function getUnreadCountByAuthor(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<string, number> {
  const sourceOk = sourceFilter === 'all';
  const filtered = notifications.filter(
    (n) =>
      n.unread &&
      n.author !== null &&
      !isNotificationMuted(n) &&
      (sourceOk || n.source === sourceFilter)
  );
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local counting map, not state
  const counts = new Map<string, number>();
  for (const n of filtered) {
    counts.set(n.author!.login, (counts.get(n.author!.login) ?? 0) + 1);
  }
  return counts;
}

export function getUnreadIdsByAuthor(
  login: string,
  source?: NotificationSource
): ReadonlySet<string> {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup set, not state
  const ids = new Set<string>();
  for (const n of notifications) {
    if (
      n.unread &&
      n.author?.login === login &&
      !isNotificationMuted(n) &&
      (source === undefined || n.source === source)
    ) {
      ids.add(n.id);
    }
  }
  return ids;
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
      indicatorMode: settingsState.indicatorMode,
      indicatorColor: settingsState.indicatorColor
    });
  } catch {
    // Badge update is best-effort
  }
}

// ── Backend event listener ──────────────────────────────────────

let knownUnreadIds = new Set<string>();
let isFirstLoad = true;

function updateFromBackend(items: UnifiedNotification[]): void {
  // Clean up locally-read IDs no longer in the notification list
  const ids = new Set(items.map((n) => n.id));
  let pruned = false;
  for (const id of locallyReadIds.keys()) {
    if (!ids.has(id)) {
      locallyReadIds.delete(id);
      pruned = true;
    }
  }
  if (pruned) persistReadIds();

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

  // Update badge accounting for locally-read and muted items
  const unreadCount = countBadgeUnread(notifications);
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
    if (isDemoMode()) {
      loadDemoData();
      return;
    }
    await tauriInvoke('trigger_poll');
  } finally {
    isLoading = false;
    hasLoadedOnce = true;
  }
}

export function refreshBadge(): void {
  updateTrayBadge(countBadgeUnread(notifications));
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

  // Snapshot unread counts before mutating state (used by markOnServers)
  const totalGhUnread = notifications.filter((n) => n.source === 'github' && n.unread).length;
  const totalGlUnread = notifications.filter((n) => n.source === 'gitlab' && n.unread).length;

  const now = Date.now();
  for (const n of unread) {
    locallyReadIds.set(n.id, now);
  }
  persistReadIds();
  notifications = notifications.map((n) =>
    n.unread && (!ids || ids.has(n.id)) ? { ...n, unread: false } : n
  );
  const unreadCount = countBadgeUnread(notifications);
  updateTrayBadge(unreadCount);

  // Play ripple sound when all notifications are cleared
  if (unreadCount === 0) {
    playNotificationSound('ripple');
  }

  // Mark on servers (best-effort)
  markOnServers(unread, { totalGhUnread, totalGlUnread }).catch(() => {});

  showToast(unread.length === 1 ? 'Marked as read' : `${unread.length} marked as read`);
}

export function markAsUnread(id: string): void {
  const notification = notifications.find((n) => n.id === id);
  if (!notification || notification.unread) return;

  locallyReadIds.delete(id);
  persistReadIds();
  notifications = notifications.map((n) => (n.id === id ? { ...n, unread: true } : n));
  updateTrayBadge(countBadgeUnread(notifications));
}

export function markAsRead(id: string): void {
  const notification = notifications.find((n) => n.id === id);
  if (!notification || !notification.unread) return;

  // Snapshot unread counts before mutating state
  const totalGhUnread = notifications.filter((n) => n.source === 'github' && n.unread).length;
  const totalGlUnread = notifications.filter((n) => n.source === 'gitlab' && n.unread).length;

  locallyReadIds.set(id, Date.now());
  persistReadIds();
  notifications = notifications.map((n) => (n.id === id ? { ...n, unread: false } : n));
  const unreadCount = countBadgeUnread(notifications);
  updateTrayBadge(unreadCount);

  // Play ripple sound when this was the last unread notification
  if (unreadCount === 0) {
    playNotificationSound('ripple');
  }

  markOnServers([notification], { totalGhUnread, totalGlUnread }).catch(() => {});

  showToast('Marked as read');
}

// ── Server-side mark helper ─────────────────────────────────────

async function markOnServers(
  items: UnifiedNotification[],
  unreadCounts: { totalGhUnread: number; totalGlUnread: number }
): Promise<void> {
  const { getGitHubConfig, getGitLabConfig } = await import('./connections.svelte');

  const ghConfig = getGitHubConfig();
  const glConfig = getGitLabConfig();

  const ghItems = items.filter((n) => n.source === 'github');
  const glItems = items.filter((n) => n.source === 'gitlab');

  // Use bulk endpoint when all unread notifications of a source are included
  if (ghItems.length > 0 && ghConfig) {
    if (ghItems.length >= unreadCounts.totalGhUnread) {
      const { markAllGitHubNotificationsRead } = await import('$lib/services/github/client');
      markAllGitHubNotificationsRead(ghConfig.token).catch((e) =>
        console.warn('[beacon] GH mark-all-read failed:', e)
      );
    } else {
      const { markGitHubThreadRead } = await import('$lib/services/github/client');
      for (const n of ghItems) {
        markGitHubThreadRead(ghConfig.token, n.id.replace('github-', '')).catch((e) =>
          console.warn('[beacon] GH mark-read failed:', n.id, e)
        );
      }
    }
  }

  if (glItems.length > 0 && glConfig) {
    if (glItems.length >= unreadCounts.totalGlUnread) {
      const { markAllGitLabTodosDone } = await import('$lib/services/gitlab/client');
      markAllGitLabTodosDone(glConfig.token, glConfig.baseUrl).catch((e) =>
        console.warn('[beacon] GL mark-all-done failed:', e)
      );
    } else {
      const { markGitLabTodoDone } = await import('$lib/services/gitlab/client');
      for (const n of glItems) {
        markGitLabTodoDone(
          glConfig.token,
          glConfig.baseUrl,
          Number(n.id.replace('gitlab-', ''))
        ).catch((e) => console.warn('[beacon] GL mark-done failed:', n.id, e));
      }
    }
  }
}
