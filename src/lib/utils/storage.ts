import type { Store } from '@tauri-apps/plugin-store';

let storeInstance: Store | null = null;

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
