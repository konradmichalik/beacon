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
  const stored = await getStorageItem<string[]>(STORAGE_KEY);
  if (stored) {
    starredIds = new Set(stored);
  }
}
