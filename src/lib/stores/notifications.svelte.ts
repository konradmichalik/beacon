import type { UnifiedNotification, NotificationSource, NotificationType } from '$lib/types';
import type { SortMode, StatusFilter, NotificationDraftFilter } from './filters.svelte';
import { filterState } from './filters.svelte';
import { settingsState } from './settings.svelte';
import { isNotificationMuted } from './mute-rules.svelte';
import { isSnoozed } from './snooze.svelte';
import { isTauri, getStorageItem, setStorageItem } from '$lib/utils/storage';
import { demoNotifications } from '$lib/utils/demo-data';
import { playNotificationSound } from '$lib/services/notification-sound';
import { showToast } from '$lib/stores/toast.svelte';
import { parseGitLabTargetUrl } from '$lib/utils/gitlab-target';
import {
  isSyntheticNotification,
  syntheticNotificationPrId
} from '$lib/utils/synthetic-notifications';

// The reactive, composed view the UI reads: `backendNotifications` (from the
// Rust polling loop) plus `syntheticNotificationsMap` (locally generated PR
// transition entries), recomputed by `recompose()`. Kept separate because the
// backend replaces its list wholesale on every emit, which would otherwise
// wipe out synthetic entries that have no server-side counterpart to re-fetch.
let notifications: UnifiedNotification[] = $state([]);

let backendNotifications: UnifiedNotification[] = [];
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

// Track GitHub notifications marked "done" (DELETE'd on the server) so a poll
// already in flight can't re-add them. Unlike locallyReadIds, this must be
// pruned by age only — a "done" thread never reappears in the backend payload,
// so pruning on absence would drop the entry on the very next poll.
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state, internal bookkeeping
const dismissedIds = new Map<string, number>();
const DISMISSED_IDS_STORAGE_KEY = 'dismissedNotificationIds';
const DISMISSED_IDS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let dismissedPersistTimer: ReturnType<typeof setTimeout> | null = null;

function persistDismissedIds(): void {
  if (dismissedPersistTimer) return;
  dismissedPersistTimer = setTimeout(() => {
    dismissedPersistTimer = null;
    const obj = Object.fromEntries(dismissedIds);
    setStorageItem(DISMISSED_IDS_STORAGE_KEY, obj).catch(() => {});
  }, 500);
}

export async function loadPersistedDismissedIds(): Promise<void> {
  const stored = await getStorageItem<Record<string, number>>(DISMISSED_IDS_STORAGE_KEY);
  if (!stored) return;
  const now = Date.now();
  for (const [id, ts] of Object.entries(stored)) {
    if (now - ts < DISMISSED_IDS_MAX_AGE_MS) {
      dismissedIds.set(id, ts);
    }
  }
}

// Synthetic PR-transition entries (draft -> ready, blocked -> mergeable) live
// here, keyed by id, separate from `backendNotifications` since they have no
// server-side thread to re-fetch and must survive a backend list replacement.
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state, internal bookkeeping
const syntheticNotificationsMap = new Map<string, UnifiedNotification>();
const SYNTHETIC_STORAGE_KEY = 'syntheticNotifications';
const SYNTHETIC_READ_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const SYNTHETIC_UNREAD_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// When a synthetic entry was actually marked read, separate from `updatedAt`
// (the detection timestamp) — the 3-day read-pruning window must count from
// there, not from detection, or an entry read long after it was detected
// vanishes on the very next poll.
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state, internal bookkeeping
const syntheticReadAtMap = new Map<string, number>();
const SYNTHETIC_READ_AT_STORAGE_KEY = 'syntheticNotificationsReadAt';

let syntheticPersistTimer: ReturnType<typeof setTimeout> | null = null;

function persistSynthetic(): void {
  if (syntheticPersistTimer) return;
  syntheticPersistTimer = setTimeout(() => {
    syntheticPersistTimer = null;
    setStorageItem(SYNTHETIC_STORAGE_KEY, Object.fromEntries(syntheticNotificationsMap)).catch(
      () => {}
    );
    setStorageItem(SYNTHETIC_READ_AT_STORAGE_KEY, Object.fromEntries(syntheticReadAtMap)).catch(
      () => {}
    );
  }, 500);
}

export async function loadPersistedSyntheticNotifications(): Promise<void> {
  const stored = await getStorageItem<Record<string, UnifiedNotification>>(SYNTHETIC_STORAGE_KEY);
  const storedReadAt = await getStorageItem<Record<string, number>>(SYNTHETIC_READ_AT_STORAGE_KEY);
  if (storedReadAt) {
    for (const [id, ts] of Object.entries(storedReadAt)) {
      syntheticReadAtMap.set(id, ts);
    }
  }
  if (stored) {
    for (const [id, notification] of Object.entries(stored)) {
      syntheticNotificationsMap.set(id, notification);
    }
    if (pruneSyntheticByAge()) persistSynthetic();
  }
  recompose();
  updateTrayBadge(countBadgeUnread(notifications));
}

function syntheticReferenceTime(n: UnifiedNotification): number {
  if (n.unread) return new Date(n.updatedAt).getTime();
  return syntheticReadAtMap.get(n.id) ?? new Date(n.updatedAt).getTime();
}

function pruneSyntheticByAge(): boolean {
  const now = Date.now();
  let changed = false;
  for (const [id, n] of syntheticNotificationsMap) {
    const maxAge = n.unread ? SYNTHETIC_UNREAD_MAX_AGE_MS : SYNTHETIC_READ_MAX_AGE_MS;
    if (now - syntheticReferenceTime(n) >= maxAge) {
      syntheticNotificationsMap.delete(id);
      syntheticReadAtMap.delete(id);
      changed = true;
    }
  }
  return changed;
}

/**
 * Also drops entries whose PR is no longer in the current list (merged,
 * closed, unassigned), but only when `openPrIds` is known — a failed fetch
 * for one source must never wipe out every synthetic entry.
 */
export function pruneSyntheticNotifications(openPrIds: ReadonlySet<string> | null): void {
  let changed = pruneSyntheticByAge();
  if (openPrIds !== null) {
    for (const id of syntheticNotificationsMap.keys()) {
      if (!openPrIds.has(syntheticNotificationPrId(id))) {
        syntheticNotificationsMap.delete(id);
        syntheticReadAtMap.delete(id);
        changed = true;
      }
    }
  }
  if (changed) {
    persistSynthetic();
    recompose();
    updateTrayBadge(countBadgeUnread(notifications));
  }
}

/** Pure composition of the backend list and the synthetic list, newest first. */
export function composeNotifications(
  backend: readonly UnifiedNotification[],
  synthetic: readonly UnifiedNotification[]
): UnifiedNotification[] {
  return [...backend, ...synthetic].sort(
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- date parsing for sort comparison
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function recompose(): void {
  notifications = composeNotifications(backendNotifications, [
    ...syntheticNotificationsMap.values()
  ]);
}

/**
 * Adds or resurfaces synthetic PR-transition entries. Called only when
 * `detectPRTransitions` reports a genuine transition, so every call here is a
 * real event worth a sound, never a re-poll echo of an existing one.
 */
export function addSyntheticNotifications(items: readonly UnifiedNotification[]): void {
  if (items.length === 0) return;
  for (const item of items) {
    syntheticNotificationsMap.set(item.id, item);
  }
  persistSynthetic();
  recompose();
  updateTrayBadge(countBadgeUnread(notifications));
  const audible = items.some((n) => !isNotificationMuted(n) && !isSnoozed(n));
  if (audible && settingsState.notifyMode !== 'disabled') {
    playNotificationSound(settingsState.notifySound);
  }
}

// Timestamp of the last time the user opened the popup
let lastSeenAt: string | null = $state(null);

export function getNotifications(): readonly UnifiedNotification[] {
  return notifications;
}

/**
 * Unread and actually shown to the user. Muted and snoozed notifications are
 * hidden from the list, so they must not be counted anywhere the user can see
 * the number either — a count that includes them leaves the tray indicator lit
 * with nothing behind it.
 */
function isUnreadAndVisible(n: UnifiedNotification): boolean {
  return n.unread && !isNotificationMuted(n) && !isSnoozed(n);
}

/** Unread count for the tray icon. */
export function countBadgeUnread(items: readonly UnifiedNotification[]): number {
  return items.filter(isUnreadAndVisible).length;
}

/** Unread, visible notifications, optionally narrowed to one platform. */
function unreadVisibleFrom(
  sourceFilter: NotificationSource | 'all'
): readonly UnifiedNotification[] {
  return notifications.filter(
    (n) => isUnreadAndVisible(n) && (sourceFilter === 'all' || n.source === sourceFilter)
  );
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

/**
 * Every filter except the mute/snooze visibility check. Shared by
 * `getFilteredNotifications` and `getHiddenCount` so the two never drift:
 * the hidden count is exactly what this scope contains minus what the former
 * returns.
 */
function applyVisibleFilters(
  sourceFilter: NotificationSource | 'all',
  projectFilter: string | null,
  typeFilter: ReadonlySet<NotificationType>,
  projectsFilter: ReadonlySet<string>,
  statusFilter: ReadonlySet<StatusFilter>,
  authorsFilter: ReadonlySet<string>,
  draftFilter: NotificationDraftFilter
): UnifiedNotification[] {
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

  return filtered;
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
  let filtered = applyVisibleFilters(
    sourceFilter,
    projectFilter,
    typeFilter,
    projectsFilter,
    statusFilter,
    authorsFilter,
    draftFilter
  );
  filtered = filtered.filter((n) => !isNotificationMuted(n) && !isSnoozed(n));

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

/**
 * How many notifications within the current source/project/type/etc. scope
 * are hidden by a mute rule or a snooze. Scoped the same way as
 * `getFilteredNotifications` — a global count would include items the user
 * isn't even looking at right now.
 */
export function getHiddenCount(
  sourceFilter: NotificationSource | 'all',
  projectFilter: string | null,
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- default param, not state
  typeFilter: ReadonlySet<NotificationType> = new Set(),
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- default param, not state
  projectsFilter: ReadonlySet<string> = new Set(),
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- default param, not state
  statusFilter: ReadonlySet<StatusFilter> = new Set(),
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- default param, not state
  authorsFilter: ReadonlySet<string> = new Set(),
  draftFilter: NotificationDraftFilter = 'all'
): number {
  const withinScope = applyVisibleFilters(
    sourceFilter,
    projectFilter,
    typeFilter,
    projectsFilter,
    statusFilter,
    authorsFilter,
    draftFilter
  );
  return withinScope.filter((n) => isNotificationMuted(n) || isSnoozed(n)).length;
}

export function getUniqueTypes(): readonly NotificationType[] {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- ephemeral dedup, not state
  return [...new Set(notifications.map((n) => n.type))].sort();
}

export function getUnreadCountByType(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<NotificationType, number> {
  const filtered = unreadVisibleFrom(sourceFilter);
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
  const filtered = unreadVisibleFrom(sourceFilter);
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
  const filtered = unreadVisibleFrom(sourceFilter);
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
  const filtered = unreadVisibleFrom(sourceFilter);
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
  const filtered = unreadVisibleFrom(sourceFilter).filter((n) => n.author !== null);
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
      isUnreadAndVisible(n) &&
      n.author?.login === login &&
      (source === undefined || n.source === source)
    ) {
      ids.add(n.id);
    }
  }
  return ids;
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

export function updateFromBackend(items: UnifiedNotification[]): void {
  // Clean up locally-read IDs no longer in the notification list
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup set, not state
  const ids = new Set(items.map((n) => n.id));
  let pruned = false;
  for (const id of locallyReadIds.keys()) {
    if (!ids.has(id)) {
      locallyReadIds.delete(id);
      pruned = true;
    }
  }
  if (pruned) persistReadIds();

  // Prune dismissedIds by age only (see comment at declaration) — a poll in
  // flight when a thread is marked done may still briefly return it, so it is
  // filtered out below rather than pruned on absence.
  const now = Date.now();
  let dismissedPruned = false;
  for (const [id, ts] of dismissedIds) {
    if (now - ts >= DISMISSED_IDS_MAX_AGE_MS) {
      dismissedIds.delete(id);
      dismissedPruned = true;
    }
  }
  if (dismissedPruned) persistDismissedIds();

  const undismissedItems = items.filter((n) => !dismissedIds.has(n.id));

  // Apply local read state overlay
  const effectiveItems = undismissedItems.map((n) =>
    locallyReadIds.has(n.id) ? { ...n, unread: false } : n
  );

  // Detect genuinely new unread notifications for sound playback
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup set, not state
  const currentUnreadIds = new Set(effectiveItems.filter((n) => n.unread).map((n) => n.id));
  if (!isFirstLoad && settingsState.notifyMode !== 'disabled') {
    const hasNew = [...currentUnreadIds].some((id) => !knownUnreadIds.has(id));
    if (hasNew) {
      playNotificationSound(settingsState.notifySound);
    }
  }
  knownUnreadIds = currentUnreadIds;
  isFirstLoad = false;

  backendNotifications = effectiveItems;
  recompose();
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- timestamp string, not reactive Date
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
  // App startup always restores persisted synthetic entries before checking
  // demo mode (see App.svelte), so a real entry from a previous non-demo
  // session could otherwise still be sitting in these maps and leak into the
  // demo view. Clear in memory only — this must never persist the clear,
  // since it would delete the user's real data.
  syntheticNotificationsMap.clear();
  syntheticReadAtMap.clear();

  // Synthetic fixtures must land in syntheticNotificationsMap, not
  // backendNotifications — otherwise marking one read leaves a duplicate
  // (the original backend copy plus the read copy the mark-read path writes
  // into the map) once recompose() merges both lists.
  backendNotifications = demoNotifications.filter((n) => !isSyntheticNotification(n));
  for (const n of demoNotifications) {
    if (isSyntheticNotification(n)) {
      syntheticNotificationsMap.set(n.id, n);
    }
  }
  recompose();
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- timestamp string, not reactive Date
  lastRefresh = new Date().toISOString();
}

// ── Mark as read/unread ─────────────────────────────────────────

export function markAllAsRead(ids?: ReadonlySet<string>): void {
  const unread = notifications.filter((n) => n.unread && (!ids || ids.has(n.id)));
  if (unread.length === 0) return;

  const unreadReal = unread.filter((n) => !isSyntheticNotification(n));
  const unreadSynthetic = unread.filter(isSyntheticNotification);

  // Snapshot unread counts before mutating state (used by markOnServers) —
  // scoped to the backend list only, synthetic entries never sync to a server
  // and must not skew the bulk-vs-per-item threshold there.
  const totalGhUnread = backendNotifications.filter(
    (n) => n.source === 'github' && n.unread
  ).length;
  const totalGlUnread = backendNotifications.filter(
    (n) => n.source === 'gitlab' && n.unread
  ).length;

  const now = Date.now();
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup set, not state
  const unreadRealIds = new Set(unreadReal.map((n) => n.id));
  for (const n of unreadReal) {
    locallyReadIds.set(n.id, now);
  }
  if (unreadReal.length > 0) persistReadIds();
  backendNotifications = backendNotifications.map((n) =>
    n.unread && unreadRealIds.has(n.id) ? { ...n, unread: false } : n
  );

  if (unreadSynthetic.length > 0) {
    for (const n of unreadSynthetic) {
      syntheticNotificationsMap.set(n.id, { ...n, unread: false });
      syntheticReadAtMap.set(n.id, now);
    }
    persistSynthetic();
  }

  recompose();
  const unreadCount = countBadgeUnread(notifications);
  updateTrayBadge(unreadCount);

  // Play ripple sound when all notifications are cleared
  if (unreadCount === 0) {
    playNotificationSound('ripple');
  }

  // Mark on servers (best-effort), real notifications only
  if (unreadReal.length > 0) {
    markOnServers(unreadReal, { totalGhUnread, totalGlUnread }).catch(() => {});
  }

  showToast(unread.length === 1 ? 'Marked as read' : `${unread.length} marked as read`);
}

export function markAsRead(id: string): void {
  const notification = notifications.find((n) => n.id === id);
  if (!notification || !notification.unread) return;

  if (isSyntheticNotification(notification)) {
    syntheticNotificationsMap.set(id, { ...notification, unread: false });
    syntheticReadAtMap.set(id, Date.now());
    persistSynthetic();
    recompose();
    const unreadCount = countBadgeUnread(notifications);
    updateTrayBadge(unreadCount);
    if (unreadCount === 0) {
      playNotificationSound('ripple');
    }
    showToast('Marked as read');
    return;
  }

  // Snapshot unread counts before mutating state
  const totalGhUnread = backendNotifications.filter(
    (n) => n.source === 'github' && n.unread
  ).length;
  const totalGlUnread = backendNotifications.filter(
    (n) => n.source === 'gitlab' && n.unread
  ).length;

  locallyReadIds.set(id, Date.now());
  persistReadIds();
  backendNotifications = backendNotifications.map((n) =>
    n.id === id ? { ...n, unread: false } : n
  );
  recompose();
  const unreadCount = countBadgeUnread(notifications);
  updateTrayBadge(unreadCount);

  // Play ripple sound when this was the last unread notification
  if (unreadCount === 0) {
    playNotificationSound('ripple');
  }

  markOnServers([notification], { totalGhUnread, totalGlUnread }).catch(() => {});

  showToast('Marked as read');
}

/**
 * GitHub-only: DELETEs the thread so it leaves the github.com inbox entirely,
 * not just the unread state. Irreversible via the API, so no undo affordance.
 */
export function markAsDone(id: string): void {
  const found = notifications.find((n) => n.id === id);
  if (!found || found.source !== 'github' || isSyntheticNotification(found)) return;
  const notification: UnifiedNotification = found;

  dismissedIds.set(id, Date.now());
  persistDismissedIds();
  backendNotifications = backendNotifications.filter((n) => n.id !== id);
  recompose();
  updateTrayBadge(countBadgeUnread(notifications));

  const threadId = notification.id.replace('github-', '');

  function rollback(): void {
    dismissedIds.delete(id);
    persistDismissedIds();
    if (!backendNotifications.some((n) => n.id === id)) {
      backendNotifications = [...backendNotifications, notification];
      recompose();
    }
    updateTrayBadge(countBadgeUnread(notifications));
    showToast('Could not mark as done on GitHub');
  }

  (async () => {
    const { getGitHubConfig } = await import('./connections.svelte');
    const ghConfig = getGitHubConfig();
    if (!ghConfig) {
      rollback();
      return;
    }
    const { markGitHubThreadDone } = await import('$lib/services/github/client');
    try {
      await markGitHubThreadDone(ghConfig.token, threadId);
      showToast('Marked as done on GitHub — this cannot be undone');
    } catch (e) {
      console.warn('[beacon] GH mark-done failed:', id, e);
      rollback();
    }
  })();
}

/**
 * Tells the forge to stop sending notifications for this thread. Unlike Mute
 * (client-side, this device only), this survives a reinstall and applies to
 * every client. Not optimistic — the forge doesn't remove the thread itself,
 * so on success this also marks the notification read to make the effect
 * visible immediately; on failure nothing changes and a toast explains why.
 */
export async function unsubscribeFromNotification(id: string): Promise<void> {
  const notification = notifications.find((n) => n.id === id);
  if (!notification || isSyntheticNotification(notification)) return;

  try {
    if (notification.source === 'github') {
      const { getGitHubConfig } = await import('./connections.svelte');
      const ghConfig = getGitHubConfig();
      if (!ghConfig) throw new Error('GitHub is not configured');
      const { unsubscribeGitHubThread } = await import('$lib/services/github/client');
      await unsubscribeGitHubThread(ghConfig.token, notification.id.replace('github-', ''));
    } else {
      const { getGitLabConfig } = await import('./connections.svelte');
      const glConfig = getGitLabConfig();
      if (!glConfig) throw new Error('GitLab is not configured');
      const target = parseGitLabTargetUrl(notification.url, glConfig.baseUrl);
      if (!target) throw new Error('Unsupported GitLab notification target');
      const { unsubscribeGitLabTarget } = await import('$lib/services/gitlab/client');
      await unsubscribeGitLabTarget(
        glConfig.token,
        glConfig.baseUrl,
        target.projectPath,
        target.targetType,
        target.iid
      );
    }
  } catch (e) {
    console.warn('[beacon] unsubscribe failed:', id, e);
    showToast('Unsubscribe failed');
    return;
  }

  showToast('Unsubscribed — the forge will no longer notify you about this thread');
  markAsRead(id);
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
