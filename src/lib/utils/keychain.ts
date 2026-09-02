import { isTauri } from './storage';

export type Forge = 'github' | 'gitlab';

/** The Keychain account for a connection: forge username plus host, so
 * multiple instances of the same forge type stay distinguishable. */
export function buildKeychainAccount(username: string, host: string): string {
  return `${username}@${host}`;
}

async function callKeychain<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

/** Store `token` in the Keychain, creating or overwriting the item. No-op
 * outside Tauri (dev/demo runs in a plain browser have no Keychain; the
 * token stays in memory for the session, as it already did before this). */
export async function setToken(forge: Forge, account: string, token: string): Promise<void> {
  if (!isTauri()) return;
  await callKeychain('keychain_set_token', { forge, account, token });
}

/** Read the token for `forge`/`account`, or `null` if there is none or the
 * app isn't running under Tauri. */
export async function getToken(forge: Forge, account: string): Promise<string | null> {
  if (!isTauri()) return null;
  return callKeychain<string | null>('keychain_get_token', { forge, account });
}

/** Remove the Keychain item for `forge`/`account`. No-op outside Tauri. */
export async function deleteToken(forge: Forge, account: string): Promise<void> {
  if (!isTauri()) return;
  await callKeychain('keychain_delete_token', { forge, account });
}
