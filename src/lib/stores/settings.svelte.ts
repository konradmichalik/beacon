import { getStorageItem, setStorageItem } from '$lib/utils/storage';

const STORAGE_KEY = 'settings';

export type BadgeMode = 'count' | 'hidden';
export type NotifyMode = 'disabled' | 'instant' | 'summary';
export type DotColor = 'none' | 'blue' | 'red' | 'yellow' | 'green';
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
  notifyMode: NotifyMode;
  notifySummaryMinutes: number; // summary interval in minutes
  notifySound: NotifySound;
  enrichPullRequests: boolean;
  globalShortcut: boolean;
  debugLog: boolean;
}

const defaultSettings: Settings = {
  pollingInterval: 300,
  theme: 'system',
  badgeMode: 'count',
  dotColor: 'blue',
  notifyMode: 'disabled',
  notifySummaryMinutes: 15,
  notifySound: 'none',
  enrichPullRequests: true,
  globalShortcut: true,
  debugLog: false
};

export const settingsState: Settings = $state({ ...defaultSettings });

let onPollingChange: (() => void) | null = null;
let onBadgeModeChange: (() => void) | null = null;
let onNotifyChange: (() => void) | null = null;
let onGlobalShortcutChange: ((enabled: boolean) => void) | null = null;
let onDebugLogChange: ((enabled: boolean) => void) | null = null;

export function setPollingChangeCallback(callback: () => void): void {
  onPollingChange = callback;
}

export function setBadgeModeChangeCallback(callback: () => void): void {
  onBadgeModeChange = callback;
}

export function setNotifyChangeCallback(callback: () => void): void {
  onNotifyChange = callback;
}

export function setGlobalShortcutChangeCallback(callback: (enabled: boolean) => void): void {
  onGlobalShortcutChange = callback;
}

export function setDebugLogChangeCallback(callback: (enabled: boolean) => void): void {
  onDebugLogChange = callback;
}

export async function initializeSettings(): Promise<void> {
  const stored = await getStorageItem<Settings>(STORAGE_KEY);
  if (stored) {
    if ((stored as unknown as Record<string, unknown>).badgeMode === 'dot') {
      stored.badgeMode = 'hidden';
      if (!stored.dotColor || stored.dotColor === 'none') {
        stored.dotColor = 'blue';
      }
    }
    Object.assign(settingsState, stored);
  }
  // Allow URL param override (used by landing page demo)
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- one-shot URL check, not reactive state
  const themeParam = new URLSearchParams(window.location.search).get('theme');
  if (themeParam === 'dark' || themeParam === 'light') {
    settingsState.theme = themeParam;
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
  if (updates.globalShortcut !== undefined && onGlobalShortcutChange) {
    onGlobalShortcutChange(updates.globalShortcut);
  }
  if (updates.debugLog !== undefined && onDebugLogChange) {
    onDebugLogChange(updates.debugLog);
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
