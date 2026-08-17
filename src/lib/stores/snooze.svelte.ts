import type { UnifiedNotification } from '$lib/types';
import { getStorageItem, setStorageItem } from '$lib/utils/storage';
import { showToast } from '$lib/stores/toast.svelte';
import {
  presetUntil,
  shouldWake,
  SNOOZE_PRESET_LABELS,
  type SnoozeEntry,
  type SnoozePreset
} from '$lib/utils/snooze';

const STORAGE_KEY = 'snoozed-notifications';
// A snooze whose timer expired this long ago is dropped from storage. Activity
// can wake a notification earlier than `until`, but its bookkeeping entry is
// only ever pruned by this age check — see the wake predicate in snooze.ts for
// why that's still correct: it's recomputed from `until`/`snapshotUpdatedAt`
// on every check, so a stale-but-unpruned entry never re-hides anything.
const PRUNE_AFTER_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

let snoozed: Record<string, SnoozeEntry> = $state({});

export function getSnoozedEntries(): Readonly<Record<string, SnoozeEntry>> {
  return snoozed;
}

// Snoozing hides notifications from the list, so the tray badge has to be
// recounted whenever it changes — same reasoning as mute-rules.svelte.ts.
let onSnoozeChange: (() => void) | null = null;

export function setSnoozeChangeCallback(callback: () => void): void {
  onSnoozeChange = callback;
}

async function persist(): Promise<void> {
  await setStorageItem(STORAGE_KEY, snoozed);
}

export async function initializeSnoozed(): Promise<void> {
  const stored = await getStorageItem<Record<string, SnoozeEntry>>(STORAGE_KEY);
  if (!stored) return;

  const now = Date.now();
  const kept: Record<string, SnoozeEntry> = {};
  for (const [id, entry] of Object.entries(stored)) {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local timestamp parse, not state
    if (now - new Date(entry.until).getTime() < PRUNE_AFTER_EXPIRY_MS) {
      kept[id] = entry;
    }
  }
  snoozed = kept;
}

export function snoozeNotification(
  notification: UnifiedNotification,
  preset: SnoozePreset,
  wakeOnUpdate: boolean
): void {
  snoozed = {
    ...snoozed,
    [notification.id]: {
      until: presetUntil(preset).toISOString(),
      snapshotUpdatedAt: notification.updatedAt,
      wakeOnUpdate
    }
  };
  persist();
  onSnoozeChange?.();
  showToast(`Snoozed until ${SNOOZE_PRESET_LABELS[preset]}`);
}

export function unsnooze(id: string): void {
  if (!(id in snoozed)) return;
  const next = { ...snoozed };
  delete next[id];
  snoozed = next;
  persist();
  onSnoozeChange?.();
}

export function isSnoozed(notification: UnifiedNotification): boolean {
  const entry = snoozed[notification.id];
  if (!entry) return false;
  return !shouldWake(entry, notification.updatedAt, Date.now());
}

export function getSnoozedNotifications(
  all: readonly UnifiedNotification[]
): readonly UnifiedNotification[] {
  return all.filter((n) => isSnoozed(n));
}
