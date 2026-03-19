import type { MuteRule, UnifiedNotification } from '$lib/types';
import { getStorageItem, setStorageItem } from '$lib/utils/storage';
import { showToast } from '$lib/stores/toast.svelte';

const STORAGE_KEY = 'mute-rules';

let muteRules: MuteRule[] = $state([]);

export function getMuteRules(): readonly MuteRule[] {
  return muteRules;
}

async function persist(): Promise<void> {
  await setStorageItem(STORAGE_KEY, [...muteRules]);
}

function isDuplicate(rule: Omit<MuteRule, 'id' | 'createdAt'>): boolean {
  return muteRules.some(
    (existing) =>
      existing.project === rule.project &&
      existing.type === rule.type &&
      existing.status === rule.status
  );
}

export async function addMuteRule(rule: Omit<MuteRule, 'id' | 'createdAt'>): Promise<void> {
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
  showToast('Mute rule created');
}

export async function removeMuteRule(id: string): Promise<void> {
  muteRules = muteRules.filter((r) => r.id !== id);
  await persist();
  showToast('Mute rule removed');
}

export function isNotificationMuted(notification: UnifiedNotification): boolean {
  return muteRules.some((rule) => {
    if (rule.project !== undefined && rule.project !== notification.repository) return false;
    if (rule.type !== undefined && rule.type !== notification.type) return false;
    if (rule.status !== undefined && rule.status !== notification.subjectState) return false;
    return true;
  });
}

export async function initializeMuteRules(): Promise<void> {
  const stored = await getStorageItem<MuteRule[]>(STORAGE_KEY);
  if (stored) {
    muteRules = stored;
  }

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
      // eslint-disable-next-line svelte/prefer-svelte-reactivity -- timestamp string, not reactive Date
      newRules.push({ id: crypto.randomUUID(), status: 'closed', createdAt: new Date().toISOString() });
    }
    if (!hasMerged) {
      // eslint-disable-next-line svelte/prefer-svelte-reactivity -- timestamp string, not reactive Date
      newRules.push({ id: crypto.randomUUID(), status: 'merged', createdAt: new Date().toISOString() });
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
