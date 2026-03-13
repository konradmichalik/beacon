import type { UnifiedNotification } from '$lib/types';
import { settingsState } from '$lib/stores/settings.svelte';
import { isTauri } from '$lib/utils/storage';

const knownIds = new Set<string>();
let summaryBuffer: UnifiedNotification[] = [];
let summaryTimer: ReturnType<typeof setInterval> | null = null;

export async function sendNotification(title: string, body: string): Promise<void> {
  if (!isTauri()) return;

  try {
    const {
      isPermissionGranted,
      requestPermission,
      sendNotification: send
    } = await import('@tauri-apps/plugin-notification');

    let permitted = await isPermissionGranted();
    if (!permitted) {
      const result = await requestPermission();
      permitted = result === 'granted';
    }
    if (!permitted) return;

    send({ title, body });
  } catch {
    // Notification is best-effort
  }
}

function notifyInstant(newItems: readonly UnifiedNotification[]): void {
  if (newItems.length === 1) {
    const n = newItems[0];
    sendNotification(n.repository, n.title);
  } else if (newItems.length > 1) {
    sendNotification(
      'Beacon',
      `${newItems.length} new notifications`
    );
  }
}

function flushSummary(): void {
  if (summaryBuffer.length === 0) return;

  const count = summaryBuffer.length;
  const repos = [...new Set(summaryBuffer.map((n) => n.repository))];

  const body = repos.length <= 3
    ? `${count} new in ${repos.join(', ')}`
    : `${count} new across ${repos.length} projects`;

  sendNotification('Beacon', body);
  summaryBuffer = [];
}

export function startSummaryTimer(): void {
  stopSummaryTimer();
  if (settingsState.notifyMode !== 'summary') return;

  summaryTimer = setInterval(flushSummary, settingsState.notifySummaryMinutes * 60 * 1000);
}

export function stopSummaryTimer(): void {
  if (summaryTimer) {
    clearInterval(summaryTimer);
    summaryTimer = null;
  }
}

/**
 * Call after each notification refresh with the full (unread) list.
 * Detects newly appeared notifications and dispatches based on mode.
 */
export function processNewNotifications(all: readonly UnifiedNotification[]): void {
  const { notifyMode } = settingsState;
  if (notifyMode === 'disabled') return;

  const unread = all.filter((n) => n.unread);
  const isFirstRun = knownIds.size === 0;

  // Seed known IDs on first run (don't notify for existing items)
  if (isFirstRun) {
    for (const n of unread) knownIds.add(n.id);
    return;
  }

  const newItems = unread.filter((n) => !knownIds.has(n.id));

  // Update known set
  knownIds.clear();
  for (const n of unread) knownIds.add(n.id);

  if (newItems.length === 0) return;

  if (notifyMode === 'instant') {
    notifyInstant(newItems);
  } else if (notifyMode === 'summary') {
    summaryBuffer.push(...newItems);
  }
}

