import { getStorageItem, setStorageItem } from '$lib/utils/storage';

const STORAGE_KEY = 'starred-prs';

let starredIds: ReadonlySet<string> = $state(new Set());

export function isStarred(prId: string): boolean {
  return starredIds.has(prId);
}

export function getStarredIds(): ReadonlySet<string> {
  return starredIds;
}

export async function toggleStar(prId: string): Promise<void> {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- immutable replacement, not mutation
  const next = new Set(starredIds);
  if (next.has(prId)) {
    next.delete(prId);
  } else {
    next.add(prId);
  }
  starredIds = next;
  await setStorageItem(STORAGE_KEY, [...next]);
}

export async function loadStarredPRs(): Promise<void> {
  const stored = await getStorageItem<unknown>(STORAGE_KEY);
  const ids = Array.isArray(stored)
    ? stored.filter((id): id is string => typeof id === 'string')
    : [];
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- immutable replacement, not mutation
  starredIds = new Set(ids);
}
