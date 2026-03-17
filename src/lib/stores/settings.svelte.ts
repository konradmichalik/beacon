import { getStorageItem, setStorageItem } from '$lib/utils/storage';

const STORAGE_KEY = 'settings';

export type BadgeMode = 'count' | 'dot';
export type NotifyMode = 'disabled' | 'instant' | 'summary';
export type DotColor = 'blue' | 'red';
export const NOTIFY_SOUNDS = [
  'none',
  'bell',
  'breeze',
  'bubble',
  'chime',
  'drop',
  'echo',
  'glow',
  'harp',
  'ping',
  'pluck',
  'pop',
  'ripple',
  'shimmer',
  'sonar',
  'spark'
] as const;

export type NotifySound = (typeof NOTIFY_SOUNDS)[number];

interface Settings {
  pollingInterval: number; // in seconds
  theme: 'light' | 'dark' | 'system';
  badgeMode: BadgeMode;
  dotColor: DotColor;
  hideClosed: boolean;
  notifyMode: NotifyMode;
  notifySummaryMinutes: number; // summary interval in minutes
  notifySound: NotifySound;
}

const defaultSettings: Settings = {
  pollingInterval: 300,
  theme: 'system',
  badgeMode: 'count',
  dotColor: 'blue',
  hideClosed: false,
  notifyMode: 'disabled',
  notifySummaryMinutes: 15,
  notifySound: 'none'
};

export const settingsState: Settings = $state({ ...defaultSettings });

let onPollingChange: (() => void) | null = null;
let onBadgeModeChange: (() => void) | null = null;
let onNotifyChange: (() => void) | null = null;

export function setPollingChangeCallback(callback: () => void): void {
  onPollingChange = callback;
}

export function setBadgeModeChangeCallback(callback: () => void): void {
  onBadgeModeChange = callback;
}

export function setNotifyChangeCallback(callback: () => void): void {
  onNotifyChange = callback;
}

export async function initializeSettings(): Promise<void> {
  const stored = await getStorageItem<Settings>(STORAGE_KEY);
  if (stored) {
    Object.assign(settingsState, stored);
  }
  applyTheme();
}

export async function updateSettings(updates: Partial<Settings>): Promise<void> {
  const pollingChanged =
    updates.pollingInterval !== undefined &&
    updates.pollingInterval !== settingsState.pollingInterval;

  Object.assign(settingsState, updates);
  await setStorageItem(STORAGE_KEY, { ...settingsState });

  if (updates.theme) {
    applyTheme();
  }
  if (pollingChanged && onPollingChange) {
    onPollingChange();
  }
  if ((updates.badgeMode !== undefined || updates.dotColor !== undefined) && onBadgeModeChange) {
    onBadgeModeChange();
  }
  if (
    (updates.notifyMode !== undefined || updates.notifySummaryMinutes !== undefined) &&
    onNotifyChange
  ) {
    onNotifyChange();
  }
}

function applyTheme(): void {
  const { theme } = settingsState;
  let resolved: 'light' | 'dark';

  if (theme === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    resolved = theme;
  }

  document.documentElement.setAttribute('data-color-mode', resolved);
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (settingsState.theme === 'system') {
      applyTheme();
    }
  });
}
