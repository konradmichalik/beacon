import type { MuteRule, UnifiedNotification } from '$lib/types';
import { getStorageItem, setStorageItem } from '$lib/utils/storage';
import { showToast } from '$lib/stores/toast.svelte';

const STORAGE_KEY = 'mute-rules';

let muteRules: MuteRule[] = $state([]);

export function getMuteRules(): readonly MuteRule[] {
  return muteRules;
}

// Muting hides notifications from the list, so the tray badge has to be
// recounted whenever the rules change. Set by the app shell to avoid importing
// the notifications store here (it already imports this one).
let onRulesChange: (() => void) | null = null;

export function setMuteRulesChangeCallback(callback: () => void): void {
  onRulesChange = callback;
}

async function persist(): Promise<void> {
  await setStorageItem(STORAGE_KEY, [...muteRules]);
}

function hasCriteria(rule: Omit<MuteRule, 'id' | 'createdAt'>): boolean {
  return (
    rule.project !== undefined ||
    rule.type !== undefined ||
    rule.status !== undefined ||
    rule.author !== undefined
  );
}

function isDuplicate(rule: Omit<MuteRule, 'id' | 'createdAt'>): boolean {
  return muteRules.some(
    (existing) =>
      existing.project === rule.project &&
      existing.type === rule.type &&
      existing.status === rule.status &&
      existing.author === rule.author
  );
}

export async function addMuteRule(rule: Omit<MuteRule, 'id' | 'createdAt'>): Promise<void> {
  if (!hasCriteria(rule)) {
    showToast('Select at least one mute criterion');
    return;
  }

  if (isDuplicate(rule)) {
    showToast('Rule already exists');
    return;
  }

  const newRule: MuteRule = {
    ...rule,
    id: crypto.randomUUID(),
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- timestamp string, not reactive Date
    createdAt: new Date().toISOString()
  };
  muteRules = [...muteRules, newRule];
  await persist();
  onRulesChange?.();
  showToast('Mute rule created');
}

export async function removeMuteRule(id: string): Promise<void> {
  muteRules = muteRules.filter((r) => r.id !== id);
  await persist();
  onRulesChange?.();
  showToast('Mute rule removed');
}

export function isNotificationMuted(notification: UnifiedNotification): boolean {
  return muteRules.some((rule) => {
    if (rule.project !== undefined && rule.project !== notification.repository) return false;
    if (rule.type !== undefined && rule.type !== notification.type) return false;
    if (rule.status !== undefined && rule.status !== notification.subjectState) return false;
    if (rule.author !== undefined && rule.author !== notification.author?.login) return false;
    return true;
  });
}

function isValidMuteRule(value: unknown): value is MuteRule {
  if (!value || typeof value !== 'object') return false;
  const rule = value as Partial<MuteRule>;
  return (
    typeof rule.id === 'string' &&
    typeof rule.createdAt === 'string' &&
    (rule.project !== undefined ||
      rule.type !== undefined ||
      rule.status !== undefined ||
      rule.author !== undefined)
  );
}

export async function initializeMuteRules(): Promise<void> {
  const stored = await getStorageItem<unknown>(STORAGE_KEY);
  muteRules = Array.isArray(stored) ? stored.filter(isValidMuteRule) : [];

  // Migrate hideClosed setting
  const settings = await getStorageItem<Record<string, unknown>>('settings');
  if (settings?.hideClosed === true) {
    const hasClosed = muteRules.some(
      (r) => r.project === undefined && r.type === undefined && r.status === 'closed'
    );
    const hasMerged = muteRules.some(
      (r) => r.project === undefined && r.type === undefined && r.status === 'merged'
    );

    const newRules: MuteRule[] = [];
    if (!hasClosed) {
      newRules.push({
        id: crypto.randomUUID(),
        status: 'closed',
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- timestamp string, not reactive Date
        createdAt: new Date().toISOString()
      });
    }
    if (!hasMerged) {
      newRules.push({
        id: crypto.randomUUID(),
        status: 'merged',
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- timestamp string, not reactive Date
        createdAt: new Date().toISOString()
      });
    }

    if (newRules.length > 0) {
      muteRules = [...muteRules, ...newRules];
      await persist();
    }

    // Remove hideClosed from settings
    delete settings.hideClosed;
    await setStorageItem('settings', settings);
  }
}
