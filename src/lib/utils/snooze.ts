export type SnoozePreset = '1h' | 'tomorrow' | 'monday';

export interface SnoozeEntry {
  readonly until: string;
  readonly snapshotUpdatedAt: string;
  readonly wakeOnUpdate: boolean;
}

export const SNOOZE_PRESET_LABELS: Record<SnoozePreset, string> = {
  '1h': '1 hour',
  tomorrow: 'Tomorrow, 9:00',
  monday: 'Monday, 9:00'
};

/** Wall-clock time a preset resolves to, relative to `now`. */
export function presetUntil(preset: SnoozePreset, now: Date = new Date()): Date {
  const result = new Date(now);

  if (preset === '1h') {
    result.setTime(result.getTime() + 60 * 60 * 1000);
    return result;
  }

  if (preset === 'tomorrow') {
    result.setDate(result.getDate() + 1);
    result.setHours(9, 0, 0, 0);
    return result;
  }

  // Always the *next* Monday, even if today already is one.
  const day = result.getDay(); // 0=Sun .. 6=Sat
  const daysUntilMonday = (8 - day) % 7 || 7;
  result.setDate(result.getDate() + daysUntilMonday);
  result.setHours(9, 0, 0, 0);
  return result;
}

/**
 * True once a snooze should end: its timer expired, or (when enabled)
 * `updatedAt` advanced past what it was at snooze time. `UnifiedNotification`
 * has no comment count or CI field, so "something changed" is the most
 * specific signal available — this can't distinguish a new comment from a
 * label edit.
 */
export function shouldWake(entry: SnoozeEntry, currentUpdatedAt: string, now: number): boolean {
  if (now >= new Date(entry.until).getTime()) return true;
  if (entry.wakeOnUpdate && currentUpdatedAt > entry.snapshotUpdatedAt) return true;
  return false;
}
