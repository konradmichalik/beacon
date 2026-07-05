import type { Store } from '@tauri-apps/plugin-store';

let storeInstance: Store | null = null;

// Keys whose values contain access tokens. Outside Tauri the only storage is
// browser localStorage (dev/demo runs on a public origin), so these must never
// be persisted or read back there.
const SENSITIVE_KEYS = new Set(['github-config', 'gitlab-config']);

export function isSensitiveStorageKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key);
}

export function isTauri(): boolean {
  return '__TAURI__' in window;
}

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    const { Store } = await import('@tauri-apps/plugin-store');
    storeInstance = await Store.load('settings.json');
  }
  return storeInstance;
}

export async function getStorageItem<T>(key: string): Promise<T | null> {
  if (isTauri()) {
    const store = await getStore();
    const value = await store.get<T>(key);
    return value ?? null;
  }
  if (isSensitiveStorageKey(key)) {
    // Never read a token from browser storage; also drop any that an older
    // build may have written.
    localStorage.removeItem(`beacon:${key}`);
    return null;
  }
  const raw = localStorage.getItem(`beacon:${key}`);
  return raw ? JSON.parse(raw) : null;
}

export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  if (isTauri()) {
    const store = await getStore();
    await store.set(key, value);
    await store.save();
    return;
  }
  if (isSensitiveStorageKey(key)) {
    // Refuse to persist tokens to browser localStorage.
    return;
  }
  localStorage.setItem(`beacon:${key}`, JSON.stringify(value));
}

export async function removeStorageItem(key: string): Promise<void> {
  if (isTauri()) {
    const store = await getStore();
    await store.delete(key);
    await store.save();
    return;
  }
  localStorage.removeItem(`beacon:${key}`);
}
